using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[Authorize]
public class InvoicesController : BaseApiController
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<InvoicesController> _logger;

    public InvoicesController(ApplicationDbContext db, ILogger<InvoicesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get all invoices with pagination and filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<InvoiceDto>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] Guid? branchId = null,
        [FromQuery] Guid? customerId = null,
        [FromQuery] InvoiceStatus? status = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? sortBy = "Date",
        [FromQuery] string sortOrder = "desc")
    {
        try
        {
            var tenantId = GetTenantId();
            
            var query = _db.Invoices
                .Include(i => i.Customer)
                .Include(i => i.Branch)
                .Include(i => i.Items).ThenInclude(item => item.Product)
                .Where(i => i.TenantId == tenantId && !i.IsDeleted)
                .AsQueryable();

            // Branch filter
            if (branchId.HasValue)
            {
                query = query.Where(i => i.BranchId == branchId.Value);
            }
            else
            {
                var userBranchId = GetBranchId();
                if (userBranchId.HasValue)
                {
                    query = query.Where(i => i.BranchId == userBranchId.Value);
                }
            }

            // Customer filter
            if (customerId.HasValue)
            {
                query = query.Where(i => i.CustomerId == customerId.Value);
            }

            // Status filter
            if (status.HasValue)
            {
                query = query.Where(i => i.Status == status.Value);
            }

            // Date range filter
            if (fromDate.HasValue)
            {
                query = query.Where(i => i.Date >= fromDate.Value);
            }
            if (toDate.HasValue)
            {
                query = query.Where(i => i.Date <= toDate.Value);
            }

            // Sorting
            query = sortBy?.ToLower() switch
            {
                "total" => sortOrder == "desc" ? query.OrderByDescending(i => i.Total) : query.OrderBy(i => i.Total),
                "status" => sortOrder == "desc" ? query.OrderByDescending(i => i.Status) : query.OrderBy(i => i.Status),
                "customer" => sortOrder == "desc" ? query.OrderByDescending(i => i.Customer.Name) : query.OrderBy(i => i.Customer.Name),
                _ => sortOrder == "desc" ? query.OrderByDescending(i => i.Date) : query.OrderBy(i => i.Date)
            };

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var invoices = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(i => new InvoiceDto(
                    i.Id, i.CustomerId, i.Customer.Name, i.BranchId, i.Branch.Name,
                    i.Date, i.Status, i.Total, i.PaidAmount,
                    i.Items.Select(item => new InvoiceItemDto(
                        item.Id, item.ProductId, item.Product.Name, item.Quantity, item.Price
                    ))
                ))
                .ToListAsync();

            var result = new PaginatedResponse<InvoiceDto>
            {
                Items = invoices,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize,
                TotalPages = totalPages
            };

            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invoices");
            return BadRequestResponse<PaginatedResponse<InvoiceDto>>("Failed to retrieve invoices");
        }
    }

    /// <summary>
    /// Get a specific invoice by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<InvoiceDto>>> GetById(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var invoice = await _db.Invoices
                .Include(i => i.Customer)
                .Include(i => i.Branch)
                .Include(i => i.Items).ThenInclude(item => item.Product)
                .Where(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted)
                .Select(i => new InvoiceDto(
                    i.Id, i.CustomerId, i.Customer.Name, i.BranchId, i.Branch.Name,
                    i.Date, i.Status, i.Total, i.PaidAmount,
                    i.Items.Select(item => new InvoiceItemDto(
                        item.Id, item.ProductId, item.Product.Name, item.Quantity, item.Price
                    ))
                ))
                .FirstOrDefaultAsync();

            if (invoice == null)
                return NotFoundResponse<InvoiceDto>("Invoice not found");

            return Success(invoice);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invoice {InvoiceId}", id);
            return BadRequestResponse<InvoiceDto>("Failed to retrieve invoice");
        }
    }

    /// <summary>
    /// Create a new invoice (from POS or manual entry)
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<InvoiceDto>>> Create([FromBody] CreateInvoiceRequest request)
    {
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            var branchId = request.BranchId ?? GetBranchId();

            if (!branchId.HasValue)
            {
                return BadRequestResponse<InvoiceDto>("Branch ID is required");
            }

            var items = request.Items?.ToList() ?? new List<CreateInvoiceItemRequest>();
            
            if (items.Count == 0)
            {
                return BadRequestResponse<InvoiceDto>("Invoice must have at least one item");
            }

            var total = items.Sum(i => i.Quantity * i.Price);

            var invoice = new Invoice
            {
                TenantId = tenantId,
                BranchId = branchId.Value,
                CustomerId = request.CustomerId ?? Guid.Empty,
                Date = DateTime.UtcNow,
                Status = InvoiceStatus.Pending,
                Total = total,
                CreatedBy = userId.ToString(),
                Items = items.Select(i => new InvoiceItem
                {
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    Price = i.Price
                }).ToList()
            };

            // Deduct stock atomically
            foreach (var item in items)
            {
                var product = await _db.Products
                    .FirstOrDefaultAsync(p => p.Id == item.ProductId && p.TenantId == tenantId);
                    
                if (product == null)
                {
                    await transaction.RollbackAsync();
                    return BadRequestResponse<InvoiceDto>($"Product not found: {item.ProductId}");
                }

                if (product.Stock < item.Quantity)
                {
                    await transaction.RollbackAsync();
                    return BadRequestResponse<InvoiceDto>($"Insufficient stock for product: {product.Name}");
                }

                product.Stock -= item.Quantity;
                product.ModifiedAt = DateTime.UtcNow;
                product.ModifiedBy = userId.ToString();
            }

            _db.Invoices.Add(invoice);
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("Invoice {InvoiceId} created by user {UserId}, total: {Total}", 
                invoice.Id, userId, total);

            // Reload to get navigation properties
            var createdInvoice = await _db.Invoices
                .Include(i => i.Customer)
                .Include(i => i.Branch)
                .Include(i => i.Items).ThenInclude(item => item.Product)
                .FirstAsync(i => i.Id == invoice.Id);

            var dto = new InvoiceDto(
                createdInvoice.Id, createdInvoice.CustomerId, createdInvoice.Customer?.Name ?? "Walk-in",
                createdInvoice.BranchId, createdInvoice.Branch?.Name ?? "Unknown",
                createdInvoice.Date, createdInvoice.Status, createdInvoice.Total, createdInvoice.PaidAmount,
                createdInvoice.Items.Select(item => new InvoiceItemDto(
                    item.Id, item.ProductId, item.Product.Name, item.Quantity, item.Price
                ))
            );

            return Created(dto, nameof(GetById), new { id = invoice.Id });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error creating invoice");
            return BadRequestResponse<InvoiceDto>("Failed to create invoice");
        }
    }

    /// <summary>
    /// Update invoice status
    /// </summary>
    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<InvoiceDto>>> UpdateStatus(Guid id, [FromBody] UpdateInvoiceStatusRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            
            var invoice = await _db.Invoices
                .Include(i => i.Customer)
                .Include(i => i.Branch)
                .Include(i => i.Items).ThenInclude(item => item.Product)
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (invoice == null)
                return NotFoundResponse<InvoiceDto>("Invoice not found");

            invoice.Status = request.Status;
            
            if (request.Status == InvoiceStatus.Paid)
            {
                invoice.PaidAmount = invoice.Total;
            }
            else if (request.PaidAmount.HasValue)
            {
                invoice.PaidAmount = request.PaidAmount.Value;
            }

            invoice.ModifiedAt = DateTime.UtcNow;
            invoice.ModifiedBy = userId.ToString();

            await _db.SaveChangesAsync();

            _logger.LogInformation("Invoice {InvoiceId} status updated to {Status} by user {UserId}", 
                id, request.Status, userId);

            var dto = new InvoiceDto(
                invoice.Id, invoice.CustomerId, invoice.Customer?.Name ?? "Walk-in",
                invoice.BranchId, invoice.Branch.Name,
                invoice.Date, invoice.Status, invoice.Total, invoice.PaidAmount,
                invoice.Items.Select(item => new InvoiceItemDto(
                    item.Id, item.ProductId, item.Product.Name, item.Quantity, item.Price
                ))
            );

            return Success(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating invoice status {InvoiceId}", id);
            return BadRequestResponse<InvoiceDto>("Failed to update invoice status");
        }
    }

    /// <summary>
    /// Get sales statistics
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<ApiResponse<InvoiceStatsDto>>> GetStats(
        [FromQuery] Guid? branchId = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null)
    {
        try
        {
            var tenantId = GetTenantId();
            
            var query = _db.Invoices.Where(i => i.TenantId == tenantId && !i.IsDeleted);

            if (branchId.HasValue)
            {
                query = query.Where(i => i.BranchId == branchId.Value);
            }

            if (fromDate.HasValue)
            {
                query = query.Where(i => i.Date >= fromDate.Value);
            }

            if (toDate.HasValue)
            {
                query = query.Where(i => i.Date <= toDate.Value);
            }

            var stats = await query
                .GroupBy(i => 1)
                .Select(g => new InvoiceStatsDto
                {
                    TotalInvoices = g.Count(),
                    TotalSales = g.Sum(i => i.Total),
                    PaidAmount = g.Sum(i => i.PaidAmount),
                    PendingAmount = g.Sum(i => i.Total - i.PaidAmount),
                    PaidCount = g.Count(i => i.Status == InvoiceStatus.Paid),
                    PendingCount = g.Count(i => i.Status == InvoiceStatus.Pending),
                    AverageOrderValue = g.Average(i => i.Total)
                })
                .FirstOrDefaultAsync() ?? new InvoiceStatsDto();

            return Success(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invoice stats");
            return BadRequestResponse<InvoiceStatsDto>("Failed to retrieve sales statistics");
        }
    }

    /// <summary>
    /// Get today's sales summary
    /// </summary>
    [HttpGet("today")]
    public async Task<ActionResult<ApiResponse<TodaySalesDto>>> GetTodaySales([FromQuery] Guid? branchId = null)
    {
        try
        {
            var tenantId = GetTenantId();
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);
            
            var query = _db.Invoices
                .Where(i => i.TenantId == tenantId && !i.IsDeleted && 
                    i.Date >= today && i.Date < tomorrow);

            if (branchId.HasValue)
            {
                query = query.Where(i => i.BranchId == branchId.Value);
            }

            var stats = await query
                .GroupBy(i => 1)
                .Select(g => new TodaySalesDto
                {
                    TotalSales = g.Sum(i => i.Total),
                    TransactionCount = g.Count(),
                    AverageOrderValue = g.Average(i => i.Total)
                })
                .FirstOrDefaultAsync() ?? new TodaySalesDto();

            return Success(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting today's sales");
            return BadRequestResponse<TodaySalesDto>("Failed to retrieve today's sales");
        }
    }
}

// DTOs
public record InvoiceDto(
    Guid Id,
    Guid? CustomerId,
    string CustomerName,
    Guid BranchId,
    string BranchName,
    DateTime Date,
    InvoiceStatus Status,
    decimal Total,
    decimal PaidAmount,
    IEnumerable<InvoiceItemDto> Items
);

public record InvoiceItemDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    int Quantity,
    decimal Price
);

public class CreateInvoiceRequest
{
    public Guid? BranchId { get; set; }
    public Guid? CustomerId { get; set; }
    public required List<CreateInvoiceItemRequest> Items { get; set; }
}

public class CreateInvoiceItemRequest
{
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}

public class UpdateInvoiceStatusRequest
{
    public InvoiceStatus Status { get; set; }
    public decimal? PaidAmount { get; set; }
}

public class InvoiceStatsDto
{
    public int TotalInvoices { get; set; }
    public decimal TotalSales { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal PendingAmount { get; set; }
    public int PaidCount { get; set; }
    public int PendingCount { get; set; }
    public decimal AverageOrderValue { get; set; }
}

public class TodaySalesDto
{
    public decimal TotalSales { get; set; }
    public int TransactionCount { get; set; }
    public decimal AverageOrderValue { get; set; }
}
