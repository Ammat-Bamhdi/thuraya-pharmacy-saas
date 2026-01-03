using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SuppliersController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public SuppliersController(ApplicationDbContext db)
    {
        _db = db;
    }

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")?.Value ?? throw new UnauthorizedAccessException());

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IEnumerable<SupplierDto>>>> GetAll()
    {
        var tenantId = GetTenantId();
        var suppliers = await _db.Suppliers
            .Where(s => s.TenantId == tenantId)
            .Select(s => new SupplierDto(
                s.Id, s.Code, s.Name, s.ContactPerson, s.Email, s.Phone, s.Address,
                s.City, s.Country, s.PaymentTerms, s.CreditLimit, s.CurrentBalance,
                s.Rating, s.Status, s.Category, s.LastOrderDate
            ))
            .ToListAsync();

        return Ok(new ApiResponse<IEnumerable<SupplierDto>>(true, suppliers));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<SupplierDto>>> GetById(Guid id)
    {
        var tenantId = GetTenantId();
        var supplier = await _db.Suppliers
            .Where(s => s.Id == id && s.TenantId == tenantId)
            .Select(s => new SupplierDto(
                s.Id, s.Code, s.Name, s.ContactPerson, s.Email, s.Phone, s.Address,
                s.City, s.Country, s.PaymentTerms, s.CreditLimit, s.CurrentBalance,
                s.Rating, s.Status, s.Category, s.LastOrderDate
            ))
            .FirstOrDefaultAsync();

        if (supplier == null)
            return NotFound(new ApiResponse<SupplierDto>(false, null, "Supplier not found"));

        return Ok(new ApiResponse<SupplierDto>(true, supplier));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<SupplierDto>>> Create([FromBody] CreateSupplierRequest request)
    {
        var tenantId = GetTenantId();
        
        var supplier = new Supplier
        {
            TenantId = tenantId,
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
            Status = SupplierStatus.Active,
            CreatedBy = User.FindFirst("sub")?.Value
        };

        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync();

        var dto = new SupplierDto(
            supplier.Id, supplier.Code, supplier.Name, supplier.ContactPerson, supplier.Email,
            supplier.Phone, supplier.Address, supplier.City, supplier.Country, supplier.PaymentTerms,
            supplier.CreditLimit, supplier.CurrentBalance, supplier.Rating, supplier.Status,
            supplier.Category, supplier.LastOrderDate
        );

        return CreatedAtAction(nameof(GetById), new { id = supplier.Id }, new ApiResponse<SupplierDto>(true, dto));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<SupplierDto>>> Update(Guid id, [FromBody] UpdateSupplierRequest request)
    {
        var tenantId = GetTenantId();
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId);

        if (supplier == null)
            return NotFound(new ApiResponse<SupplierDto>(false, null, "Supplier not found"));

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
        supplier.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        var dto = new SupplierDto(
            supplier.Id, supplier.Code, supplier.Name, supplier.ContactPerson, supplier.Email,
            supplier.Phone, supplier.Address, supplier.City, supplier.Country, supplier.PaymentTerms,
            supplier.CreditLimit, supplier.CurrentBalance, supplier.Rating, supplier.Status,
            supplier.Category, supplier.LastOrderDate
        );

        return Ok(new ApiResponse<SupplierDto>(true, dto));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id)
    {
        var tenantId = GetTenantId();
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId);

        if (supplier == null)
            return NotFound(new ApiResponse<bool>(false, false, "Supplier not found"));

        supplier.IsDeleted = true;
        supplier.ModifiedAt = DateTime.UtcNow;
        supplier.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<bool>(true, true, "Supplier deleted"));
    }
}

