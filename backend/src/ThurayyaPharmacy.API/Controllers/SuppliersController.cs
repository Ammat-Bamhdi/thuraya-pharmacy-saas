using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[Authorize]
public class SuppliersController : BaseApiController
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<SuppliersController> _logger;

    public SuppliersController(ApplicationDbContext db, ILogger<SuppliersController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get all suppliers with pagination and filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<SupplierDto>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] SupplierStatus? status = null,
        [FromQuery] string? category = null,
        [FromQuery] string? sortBy = "Name",
        [FromQuery] string sortOrder = "asc")
    {
        try
        {
            var tenantId = GetTenantId();
            
            var query = _db.Suppliers
                .Where(s => s.TenantId == tenantId && !s.IsDeleted)
                .AsQueryable();

            // Filters
            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(s =>
                    s.Name.ToLower().Contains(search) ||
                    s.Code.ToLower().Contains(search) ||
                    (s.ContactPerson != null && s.ContactPerson.ToLower().Contains(search)) ||
                    (s.Email != null && s.Email.ToLower().Contains(search)));
            }

            if (status.HasValue)
            {
                query = query.Where(s => s.Status == status.Value);
            }

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(s => s.Category == category);
            }

            // Sorting
            query = sortBy?.ToLower() switch
            {
                "code" => sortOrder == "desc" ? query.OrderByDescending(s => s.Code) : query.OrderBy(s => s.Code),
                "status" => sortOrder == "desc" ? query.OrderByDescending(s => s.Status) : query.OrderBy(s => s.Status),
                "rating" => sortOrder == "desc" ? query.OrderByDescending(s => s.Rating) : query.OrderBy(s => s.Rating),
                "balance" => sortOrder == "desc" ? query.OrderByDescending(s => s.CurrentBalance) : query.OrderBy(s => s.CurrentBalance),
                "lastorder" => sortOrder == "desc" ? query.OrderByDescending(s => s.LastOrderDate) : query.OrderBy(s => s.LastOrderDate),
                _ => sortOrder == "desc" ? query.OrderByDescending(s => s.Name) : query.OrderBy(s => s.Name)
            };

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var suppliers = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(s => new SupplierDto(
                    s.Id, s.Code, s.Name, s.ContactPerson, s.Email, s.Phone, s.Address,
                    s.City, s.Country, s.PaymentTerms, s.CreditLimit, s.CurrentBalance,
                    s.Rating, s.Status, s.Category, s.LastOrderDate
                ))
                .ToListAsync();

            var result = new PaginatedResponse<SupplierDto>
            {
                Items = suppliers,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize,
                TotalPages = totalPages
            };

            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting suppliers");
            return BadRequestResponse<PaginatedResponse<SupplierDto>>("Failed to retrieve suppliers");
        }
    }

    /// <summary>
    /// Get a specific supplier by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<SupplierDto>>> GetById(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var supplier = await _db.Suppliers
                .Where(s => s.Id == id && s.TenantId == tenantId && !s.IsDeleted)
                .Select(s => new SupplierDto(
                    s.Id, s.Code, s.Name, s.ContactPerson, s.Email, s.Phone, s.Address,
                    s.City, s.Country, s.PaymentTerms, s.CreditLimit, s.CurrentBalance,
                    s.Rating, s.Status, s.Category, s.LastOrderDate
                ))
                .FirstOrDefaultAsync();

            if (supplier == null)
                return NotFoundResponse<SupplierDto>("Supplier not found");

            return Success(supplier);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting supplier {SupplierId}", id);
            return BadRequestResponse<SupplierDto>("Failed to retrieve supplier");
        }
    }

    /// <summary>
    /// Create a new supplier
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<SupplierDto>>> Create([FromBody] CreateSupplierRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();

            // Check for duplicate code
            var existingCode = await _db.Suppliers
                .AnyAsync(s => s.TenantId == tenantId && s.Code == request.Code && !s.IsDeleted);

            if (existingCode)
            {
                return BadRequestResponse<SupplierDto>("A supplier with this code already exists");
            }

            var supplier = new Supplier
            {
                TenantId = tenantId,
                Code = request.Code,
                Name = request.Name,
                ContactPerson = request.ContactPerson ?? "",
                Email = request.Email ?? "",
                Phone = request.Phone ?? "",
                Address = request.Address ?? "",
                City = request.City ?? "",
                Country = request.Country ?? "",
                PaymentTerms = request.PaymentTerms ?? "Net 30",
                CreditLimit = request.CreditLimit,
                Category = request.Category ?? "General",
                Status = SupplierStatus.Active,
                Rating = 0,
                CurrentBalance = 0,
                CreatedBy = userId.ToString()
            };

            _db.Suppliers.Add(supplier);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Supplier {SupplierId} created by user {UserId}", supplier.Id, userId);

            var dto = new SupplierDto(
                supplier.Id, supplier.Code, supplier.Name, supplier.ContactPerson, supplier.Email,
                supplier.Phone, supplier.Address, supplier.City, supplier.Country, supplier.PaymentTerms,
                supplier.CreditLimit, supplier.CurrentBalance, supplier.Rating, supplier.Status,
                supplier.Category, supplier.LastOrderDate
            );

            return Created(dto, nameof(GetById), new { id = supplier.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating supplier");
            return BadRequestResponse<SupplierDto>("Failed to create supplier");
        }
    }

    /// <summary>
    /// Update an existing supplier
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<SupplierDto>>> Update(Guid id, [FromBody] UpdateSupplierRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            
            var supplier = await _db.Suppliers
                .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId && !s.IsDeleted);

            if (supplier == null)
                return NotFoundResponse<SupplierDto>("Supplier not found");

            if (request.Name != null) supplier.Name = request.Name;
            if (request.ContactPerson != null) supplier.ContactPerson = request.ContactPerson;
            if (request.Email != null) supplier.Email = request.Email;
            if (request.Phone != null) supplier.Phone = request.Phone;
            if (request.Address != null) supplier.Address = request.Address;
            if (request.City != null) supplier.City = request.City;
            if (request.Country != null) supplier.Country = request.Country;
            if (request.PaymentTerms != null) supplier.PaymentTerms = request.PaymentTerms;
            if (request.CreditLimit.HasValue) supplier.CreditLimit = request.CreditLimit.Value;
            if (request.Rating.HasValue) supplier.Rating = request.Rating.Value;
            if (request.Status.HasValue) supplier.Status = request.Status.Value;
            if (request.Category != null) supplier.Category = request.Category;

            supplier.ModifiedAt = DateTime.UtcNow;
            supplier.ModifiedBy = userId.ToString();

            await _db.SaveChangesAsync();

            _logger.LogInformation("Supplier {SupplierId} updated by user {UserId}", id, userId);

            var dto = new SupplierDto(
                supplier.Id, supplier.Code, supplier.Name, supplier.ContactPerson, supplier.Email,
                supplier.Phone, supplier.Address, supplier.City, supplier.Country, supplier.PaymentTerms,
                supplier.CreditLimit, supplier.CurrentBalance, supplier.Rating, supplier.Status,
                supplier.Category, supplier.LastOrderDate
            );

            return Success(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating supplier {SupplierId}", id);
            return BadRequestResponse<SupplierDto>("Failed to update supplier");
        }
    }

    /// <summary>
    /// Delete a supplier (soft delete)
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            
            var supplier = await _db.Suppliers
                .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId && !s.IsDeleted);

            if (supplier == null)
                return NotFoundResponse<bool>("Supplier not found");

            // Check for active purchase orders
            var hasActivePOs = await _db.PurchaseOrders
                .AnyAsync(po => po.SupplierId == id && !po.IsDeleted && 
                    (po.Status == POStatus.Draft || po.Status == POStatus.Sent));

            if (hasActivePOs)
            {
                return BadRequestResponse<bool>("Cannot delete supplier with active purchase orders");
            }

            supplier.IsDeleted = true;
            supplier.ModifiedAt = DateTime.UtcNow;
            supplier.ModifiedBy = userId.ToString();

            await _db.SaveChangesAsync();

            _logger.LogInformation("Supplier {SupplierId} deleted by user {UserId}", id, userId);

            return Success(true, "Supplier deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting supplier {SupplierId}", id);
            return BadRequestResponse<bool>("Failed to delete supplier");
        }
    }

    /// <summary>
    /// Get supplier statistics
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<ApiResponse<SupplierStatsDto>>> GetStats()
    {
        try
        {
            var tenantId = GetTenantId();
            
            var stats = await _db.Suppliers
                .Where(s => s.TenantId == tenantId && !s.IsDeleted)
                .GroupBy(s => 1)
                .Select(g => new SupplierStatsDto
                {
                    TotalSuppliers = g.Count(),
                    ActiveSuppliers = g.Count(s => s.Status == SupplierStatus.Active),
                    TotalBalance = g.Sum(s => s.CurrentBalance),
                    AverageRating = g.Average(s => s.Rating)
                })
                .FirstOrDefaultAsync() ?? new SupplierStatsDto();

            return Success(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting supplier stats");
            return BadRequestResponse<SupplierStatsDto>("Failed to retrieve supplier statistics");
        }
    }
}

// DTOs
public record SupplierDto(
    Guid Id,
    string Code,
    string Name,
    string ContactPerson,
    string Email,
    string Phone,
    string Address,
    string City,
    string Country,
    string PaymentTerms,
    decimal CreditLimit,
    decimal CurrentBalance,
    int Rating,
    SupplierStatus Status,
    string Category,
    DateTime? LastOrderDate
);

public class CreateSupplierRequest
{
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string? ContactPerson { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? PaymentTerms { get; set; }
    public decimal CreditLimit { get; set; }
    public string? Category { get; set; }
}

public class UpdateSupplierRequest
{
    public string? Name { get; set; }
    public string? ContactPerson { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? PaymentTerms { get; set; }
    public decimal? CreditLimit { get; set; }
    public int? Rating { get; set; }
    public SupplierStatus? Status { get; set; }
    public string? Category { get; set; }
}

public class SupplierStatsDto
{
    public int TotalSuppliers { get; set; }
    public int ActiveSuppliers { get; set; }
    public decimal TotalBalance { get; set; }
    public double AverageRating { get; set; }
}
