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
public class CustomersController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public CustomersController(ApplicationDbContext db)
    {
        _db = db;
    }

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")?.Value ?? throw new UnauthorizedAccessException());

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IEnumerable<CustomerDto>>>> GetAll()
    {
        var tenantId = GetTenantId();
        var customers = await _db.Customers
            .Include(c => c.AssignedSalesRep)
            .Where(c => c.TenantId == tenantId)
            .Select(c => new CustomerDto(
                c.Id, c.Name, c.CompanyName, c.Email, c.Phone, c.BillingAddress,
                c.City, c.Country, c.Type, c.PaymentTerms, c.CreditLimit, c.Balance,
                c.PriceGroup, c.AssignedSalesRep != null ? c.AssignedSalesRep.Name : null
            ))
            .ToListAsync();

        return Ok(new ApiResponse<IEnumerable<CustomerDto>>(true, customers));
    }

    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<IEnumerable<CustomerDto>>>> Search([FromQuery] string q)
    {
        var tenantId = GetTenantId();
        var customers = await _db.Customers
            .Where(c => c.TenantId == tenantId && 
                (c.Name.Contains(q) || c.Phone.Contains(q) || (c.Email != null && c.Email.Contains(q))))
            .Take(20)
            .Select(c => new CustomerDto(
                c.Id, c.Name, c.CompanyName, c.Email, c.Phone, c.BillingAddress,
                c.City, c.Country, c.Type, c.PaymentTerms, c.CreditLimit, c.Balance,
                c.PriceGroup, null
            ))
            .ToListAsync();

        return Ok(new ApiResponse<IEnumerable<CustomerDto>>(true, customers));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CustomerDto>>> GetById(Guid id)
    {
        var tenantId = GetTenantId();
        var customer = await _db.Customers
            .Include(c => c.AssignedSalesRep)
            .Where(c => c.Id == id && c.TenantId == tenantId)
            .Select(c => new CustomerDto(
                c.Id, c.Name, c.CompanyName, c.Email, c.Phone, c.BillingAddress,
                c.City, c.Country, c.Type, c.PaymentTerms, c.CreditLimit, c.Balance,
                c.PriceGroup, c.AssignedSalesRep != null ? c.AssignedSalesRep.Name : null
            ))
            .FirstOrDefaultAsync();

        if (customer == null)
            return NotFound(new ApiResponse<CustomerDto>(false, null, "Customer not found"));

        return Ok(new ApiResponse<CustomerDto>(true, customer));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<CustomerDto>>> Create([FromBody] CreateCustomerRequest request)
    {
        var tenantId = GetTenantId();
        
        var customer = new Customer
        {
            TenantId = tenantId,
            Name = request.Name,
            Phone = request.Phone,
            CompanyName = request.CompanyName,
            Email = request.Email,
            BillingAddress = request.BillingAddress,
            City = request.City,
            Country = request.Country,
            Type = request.Type,
            PaymentTerms = request.PaymentTerms,
            CreditLimit = request.CreditLimit,
            PriceGroup = request.PriceGroup,
            CreatedBy = User.FindFirst("sub")?.Value
        };

        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();

        var dto = new CustomerDto(
            customer.Id, customer.Name, customer.CompanyName, customer.Email, customer.Phone,
            customer.BillingAddress, customer.City, customer.Country, customer.Type,
            customer.PaymentTerms, customer.CreditLimit, customer.Balance, customer.PriceGroup, null
        );

        return CreatedAtAction(nameof(GetById), new { id = customer.Id }, new ApiResponse<CustomerDto>(true, dto));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CustomerDto>>> Update(Guid id, [FromBody] UpdateCustomerRequest request)
    {
        var tenantId = GetTenantId();
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId);

        if (customer == null)
            return NotFound(new ApiResponse<CustomerDto>(false, null, "Customer not found"));

        if (request.Name != null) customer.Name = request.Name;
        if (request.Phone != null) customer.Phone = request.Phone;
        if (request.CompanyName != null) customer.CompanyName = request.CompanyName;
        if (request.Email != null) customer.Email = request.Email;
        if (request.BillingAddress != null) customer.BillingAddress = request.BillingAddress;
        if (request.City != null) customer.City = request.City;
        if (request.Country != null) customer.Country = request.Country;
        if (request.Type.HasValue) customer.Type = request.Type.Value;
        if (request.PaymentTerms != null) customer.PaymentTerms = request.PaymentTerms;
        if (request.CreditLimit.HasValue) customer.CreditLimit = request.CreditLimit.Value;
        if (request.PriceGroup.HasValue) customer.PriceGroup = request.PriceGroup;

        customer.ModifiedAt = DateTime.UtcNow;
        customer.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        var dto = new CustomerDto(
            customer.Id, customer.Name, customer.CompanyName, customer.Email, customer.Phone,
            customer.BillingAddress, customer.City, customer.Country, customer.Type,
            customer.PaymentTerms, customer.CreditLimit, customer.Balance, customer.PriceGroup, null
        );

        return Ok(new ApiResponse<CustomerDto>(true, dto));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id)
    {
        var tenantId = GetTenantId();
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId);

        if (customer == null)
            return NotFound(new ApiResponse<bool>(false, false, "Customer not found"));

        customer.IsDeleted = true;
        customer.ModifiedAt = DateTime.UtcNow;
        customer.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<bool>(true, true, "Customer deleted"));
    }
}

