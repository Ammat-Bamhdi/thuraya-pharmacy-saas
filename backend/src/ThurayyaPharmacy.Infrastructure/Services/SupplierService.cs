using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Application.Mappings;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.Infrastructure.Services;

public class SupplierService : ISupplierService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<SupplierService> _logger;

    public SupplierService(ApplicationDbContext db, ILogger<SupplierService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<PaginatedResponse<SupplierDto>> GetAllAsync(
        int page,
        int pageSize,
        string? search,
        SupplierStatus? status,
        string? category,
        string? sortBy,
        string sortOrder,
        CancellationToken ct)
    {
        var query = _db.Suppliers.AsQueryable();

        if (!string.IsNullOrEmpty(search))
        {
            search = search.ToLower();
            query = query.Where(s => s.Name.ToLower().Contains(search) || s.Code.ToLower().Contains(search));
        }

        if (status.HasValue) query = query.Where(s => s.Status == status);
        if (!string.IsNullOrEmpty(category)) query = query.Where(s => s.Category == category);

        query = sortOrder.ToLower() == "desc"
            ? query.OrderByDescending(s => EF.Property<object>(s, sortBy ?? "Name"))
            : query.OrderBy(s => EF.Property<object>(s, sortBy ?? "Name"));

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => s.ToDto())
            .ToListAsync(ct);

        return PaginatedResponse<SupplierDto>.Create(items, totalCount, page, pageSize);
    }

    public async Task<SupplierDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (supplier == null) throw new KeyNotFoundException("Supplier not found");
        return supplier.ToDto();
    }

    public async Task<SupplierDto> CreateAsync(CreateSupplierRequest request, CancellationToken ct)
    {
        if (await _db.Suppliers.AnyAsync(s => s.Code == request.Code, ct))
            throw new ArgumentException("A supplier with this code already exists");

        var supplier = new Supplier
        {
            Code = request.Code,
            Name = request.Name,
            ContactPerson = request.ContactPerson,
            Email = request.Email,
            Phone = request.Phone,
            Address = request.Address,
            City = request.City,
            Country = request.Country,
            PaymentTerms = request.PaymentTerms,
            CreditLimit = request.CreditLimit,
            Category = request.Category,
            CreatedAt = DateTime.UtcNow
        };

        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync(ct);

        return supplier.ToDto();
    }

    public async Task<SupplierDto> UpdateAsync(Guid id, UpdateSupplierRequest request, CancellationToken ct)
    {
        var supplier = await _db.Suppliers.FindAsync(new object[] { id }, ct);
        if (supplier == null) throw new KeyNotFoundException("Supplier not found");

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
        await _db.SaveChangesAsync(ct);

        return supplier.ToDto();
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var supplier = await _db.Suppliers.FindAsync(new object[] { id }, ct);
        if (supplier == null) return false;

        supplier.IsDeleted = true;
        supplier.ModifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return true;
    }

    public async Task<SupplierStatsDto> GetStatsAsync(CancellationToken ct)
    {
        var stats = await _db.Suppliers
            .GroupBy(s => 1)
            .Select(g => new SupplierStatsDto(
                g.Count(),
                g.Count(s => s.Status == SupplierStatus.Active),
                g.Count(s => s.Status == SupplierStatus.Inactive),
                g.Sum(s => s.CurrentBalance),
                g.Select(s => s.Category).Distinct().Count()
            ))
            .FirstOrDefaultAsync(ct) ?? new SupplierStatsDto(0, 0, 0, 0, 0);

        return stats;
    }
}