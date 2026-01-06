using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Application.Mappings;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.Infrastructure.Services;

public class InvoiceService : IInvoiceService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<InvoiceService> _logger;

    public InvoiceService(ApplicationDbContext db, ILogger<InvoiceService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<PaginatedResponse<InvoiceDto>> GetAllAsync(
        int page,
        int pageSize,
        Guid? branchId,
        Guid? customerId,
        InvoiceStatus? status,
        DateTime? fromDate,
        DateTime? toDate,
        string? sortBy,
        string sortOrder,
        CancellationToken ct)
    {
        var query = _db.Invoices
            .Include(i => i.Customer)
            .Include(i => i.Branch)
            .Include(i => i.Items)
            .ThenInclude(it => it.Product)
            .AsQueryable();

        if (branchId.HasValue) query = query.Where(i => i.BranchId == branchId);
        if (customerId.HasValue) query = query.Where(i => i.CustomerId == customerId);
        if (status.HasValue) query = query.Where(i => i.Status == status);
        if (fromDate.HasValue) query = query.Where(i => i.Date >= fromDate);
        if (toDate.HasValue) query = query.Where(i => i.Date <= toDate);

        query = sortOrder.ToLower() == "desc"
            ? query.OrderByDescending(i => EF.Property<object>(i, sortBy ?? "Date"))
            : query.OrderBy(i => EF.Property<object>(i, sortBy ?? "Date"));

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => i.ToDto())
            .ToListAsync(ct);

        return PaginatedResponse<InvoiceDto>.Create(items, totalCount, page, pageSize);
    }

    public async Task<InvoiceDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Customer)
            .Include(i => i.Branch)
            .Include(i => i.Items)
            .ThenInclude(it => it.Product)
            .FirstOrDefaultAsync(i => i.Id == id, ct);

        if (invoice == null) throw new KeyNotFoundException("Invoice not found");

        return invoice.ToDto();
    }

    public async Task<InvoiceDto> CreateAsync(CreateInvoiceRequest request, Guid userId, CancellationToken ct)
    {
        using var transaction = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var invoice = new Invoice
            {
                CustomerId = request.CustomerId,
                BranchId = request.BranchId,
                Date = DateTime.UtcNow,
                Status = InvoiceStatus.Paid, // Simplified for now
                CreatedBy = userId.ToString(),
                CreatedAt = DateTime.UtcNow
            };

            decimal total = 0;
            foreach (var itemRequest in request.Items)
            {
                var product = await _db.Products.FindAsync(new object[] { itemRequest.ProductId }, ct);
                if (product == null) throw new KeyNotFoundException($"Product {itemRequest.ProductId} not found");

                if (product.Stock < itemRequest.Quantity)
                    throw new InvalidOperationException($"Insufficient stock for product {product.Name}");

                // Update stock
                product.Stock -= itemRequest.Quantity;
                product.ModifiedAt = DateTime.UtcNow;

                var item = new InvoiceItem
                {
                    ProductId = itemRequest.ProductId,
                    Quantity = itemRequest.Quantity,
                    Price = itemRequest.Price,
                    BranchId = request.BranchId,
                    CreatedAt = DateTime.UtcNow
                };

                invoice.Items.Add(item);
                total += item.Quantity * item.Price;
            }

            invoice.Total = total;
            invoice.PaidAmount = total;

            _db.Invoices.Add(invoice);
            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            // Re-fetch to get includes
            return await GetByIdAsync(invoice.Id, ct);
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<InvoiceDto> UpdateStatusAsync(Guid id, InvoiceStatus status, CancellationToken ct)
    {
        var invoice = await _db.Invoices.FindAsync(new object[] { id }, ct);
        if (invoice == null) throw new KeyNotFoundException("Invoice not found");

        invoice.Status = status;
        invoice.ModifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<InvoiceStatsDto> GetStatsAsync(Guid? branchId, DateTime? fromDate, DateTime? toDate, CancellationToken ct)
    {
        var query = _db.Invoices.AsQueryable();
        if (branchId.HasValue) query = query.Where(i => i.BranchId == branchId);
        if (fromDate.HasValue) query = query.Where(i => i.Date >= fromDate);
        if (toDate.HasValue) query = query.Where(i => i.Date <= toDate);

        var statsList = await query
            .GroupBy(i => 1)
            .Select(g => new InvoiceStatsDto(
                g.Sum(i => i.Total),
                g.Count(),
                g.Count() > 0 ? g.Average(i => i.Total) : 0,
                0, // Tax not implemented in entity yet
                0, // Discount not implemented in entity yet
                g.Count(i => i.Status == InvoiceStatus.Pending),
                g.Count(i => i.Status == InvoiceStatus.Paid),
                g.Count(i => i.Status == InvoiceStatus.Cancelled)
            ))
            .ToListAsync(ct);

        return statsList.FirstOrDefault() ?? new InvoiceStatsDto(0, 0, 0, 0, 0, 0, 0, 0);
    }

    public async Task<TodaySalesDto> GetTodaySalesAsync(Guid? branchId, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);

        var query = _db.Invoices.AsQueryable();
        if (branchId.HasValue) query = query.Where(i => i.BranchId == branchId);

        var todaySales = await query
            .Where(i => i.Date >= today)
            .GroupBy(i => 1)
            .Select(g => new { Total = g.Sum(i => i.Total), Count = g.Count() })
            .FirstOrDefaultAsync(ct);

        var yesterdaySales = await query
            .Where(i => i.Date >= yesterday && i.Date < today)
            .SumAsync(i => (decimal?)i.Total, ct) ?? 0;

        decimal todayTotal = todaySales?.Total ?? 0;
        int todayCount = todaySales?.Count ?? 0;

        double growth = yesterdaySales > 0 
            ? (double)((todayTotal - yesterdaySales) / yesterdaySales * 100) 
            : 0;

        return new TodaySalesDto(todayTotal, todayCount, yesterdaySales, growth);
    }
}