using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[Authorize]
public class CustomersController : BaseApiController
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<CustomersController> _logger;

    public CustomersController(ApplicationDbContext db, ILogger<CustomersController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get all customers with pagination and filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<CustomerDto>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] CustomerType? type = null,
        [FromQuery] string? sortBy = "Name",
        [FromQuery] string sortOrder = "asc")
    {
        try
        {
            var tenantId = GetTenantId();
            
            var query = _db.Customers
                .Include(c => c.AssignedSalesRep)
                .Where(c => c.TenantId == tenantId && !c.IsDeleted)
                .AsQueryable();

            // Search filter
            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(c =>
                    c.Name.ToLower().Contains(search) ||
                    c.Phone.ToLower().Contains(search) ||
                    (c.Email != null && c.Email.ToLower().Contains(search)) ||
                    (c.CompanyName != null && c.CompanyName.ToLower().Contains(search)));
            }

            // Type filter
            if (type.HasValue)
            {
                query = query.Where(c => c.Type == type.Value);
            }

            // Sorting
            query = sortBy?.ToLower() switch
            {
                "company" => sortOrder == "desc" ? query.OrderByDescending(c => c.CompanyName) : query.OrderBy(c => c.CompanyName),
                "type" => sortOrder == "desc" ? query.OrderByDescending(c => c.Type) : query.OrderBy(c => c.Type),
                "balance" => sortOrder == "desc" ? query.OrderByDescending(c => c.Balance) : query.OrderBy(c => c.Balance),
                "createdat" => sortOrder == "desc" ? query.OrderByDescending(c => c.CreatedAt) : query.OrderBy(c => c.CreatedAt),
                _ => sortOrder == "desc" ? query.OrderByDescending(c => c.Name) : query.OrderBy(c => c.Name)
            };

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var customers = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new CustomerDto(
                    c.Id, c.Name, c.CompanyName, c.Email, c.Phone, c.BillingAddress,
                    c.City, c.Country, c.Type, c.PaymentTerms, c.CreditLimit, c.Balance,
                    c.PriceGroup, c.AssignedSalesRep != null ? c.AssignedSalesRep.Name : null
                ))
                .ToListAsync();

            var result = new PaginatedResponse<CustomerDto>
            {
                Items = customers,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize,
                TotalPages = totalPages
            };

            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting customers");
            return BadRequestResponse<PaginatedResponse<CustomerDto>>("Failed to retrieve customers");
        }
    }

    /// <summary>
    /// Search customers (quick search for autocomplete)
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<List<CustomerDto>>>> Search([FromQuery] string q)
    {
        try
        {
            var tenantId = GetTenantId();
            var searchLower = q?.ToLower() ?? "";
            
            var customers = await _db.Customers
                .Where(c => c.TenantId == tenantId && !c.IsDeleted &&
                    (c.Name.ToLower().Contains(searchLower) || 
                     c.Phone.ToLower().Contains(searchLower) || 
                     (c.Email != null && c.Email.ToLower().Contains(searchLower))))
                .Take(20)
                .Select(c => new CustomerDto(
                    c.Id, c.Name, c.CompanyName, c.Email, c.Phone, c.BillingAddress,
                    c.City, c.Country, c.Type, c.PaymentTerms, c.CreditLimit, c.Balance,
                    c.PriceGroup, null
                ))
                .ToListAsync();

            return Success(customers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching customers");
            return BadRequestResponse<List<CustomerDto>>("Failed to search customers");
        }
    }

    /// <summary>
    /// Get a specific customer by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CustomerDto>>> GetById(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var customer = await _db.Customers
                .Include(c => c.AssignedSalesRep)
                .Where(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted)
                .Select(c => new CustomerDto(
                    c.Id, c.Name, c.CompanyName, c.Email, c.Phone, c.BillingAddress,
                    c.City, c.Country, c.Type, c.PaymentTerms, c.CreditLimit, c.Balance,
                    c.PriceGroup, c.AssignedSalesRep != null ? c.AssignedSalesRep.Name : null
                ))
                .FirstOrDefaultAsync();

            if (customer == null)
                return NotFoundResponse<CustomerDto>("Customer not found");

            return Success(customer);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting customer {CustomerId}", id);
            return BadRequestResponse<CustomerDto>("Failed to retrieve customer");
        }
    }

    /// <summary>
    /// Create a new customer
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<CustomerDto>>> Create([FromBody] CreateCustomerRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();

            // Check for duplicate phone
            if (!string.IsNullOrWhiteSpace(request.Phone))
            {
                var existingPhone = await _db.Customers
                    .AnyAsync(c => c.TenantId == tenantId && c.Phone == request.Phone && !c.IsDeleted);

                if (existingPhone)
                {
                    return BadRequestResponse<CustomerDto>("A customer with this phone number already exists");
                }
            }

            var customer = new Customer
            {
                TenantId = tenantId,
                Name = request.Name,
                Phone = request.Phone ?? "",
                CompanyName = request.CompanyName ?? "",
                Email = request.Email ?? "",
                BillingAddress = request.BillingAddress ?? "",
                City = request.City ?? "",
                Country = request.Country ?? "",
                Type = request.Type,
                PaymentTerms = request.PaymentTerms ?? "Cash",
                CreditLimit = request.CreditLimit,
                PriceGroup = request.PriceGroup ?? PriceGroup.Retail,
                CreatedBy = userId.ToString()
            };

            _db.Customers.Add(customer);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Customer {CustomerId} created by user {UserId}", customer.Id, userId);

            var dto = new CustomerDto(
                customer.Id, customer.Name, customer.CompanyName, customer.Email, customer.Phone,
                customer.BillingAddress, customer.City, customer.Country, customer.Type,
                customer.PaymentTerms, customer.CreditLimit, customer.Balance, customer.PriceGroup, null
            );

            return Created(dto, nameof(GetById), new { id = customer.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating customer");
            return BadRequestResponse<CustomerDto>("Failed to create customer");
        }
    }

    /// <summary>
    /// Update an existing customer
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CustomerDto>>> Update(Guid id, [FromBody] UpdateCustomerRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            
            var customer = await _db.Customers
                .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);

            if (customer == null)
                return NotFoundResponse<CustomerDto>("Customer not found");

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
            if (request.PriceGroup.HasValue) customer.PriceGroup = request.PriceGroup.Value;

            customer.ModifiedAt = DateTime.UtcNow;
            customer.ModifiedBy = userId.ToString();

            await _db.SaveChangesAsync();

            _logger.LogInformation("Customer {CustomerId} updated by user {UserId}", id, userId);

            var dto = new CustomerDto(
                customer.Id, customer.Name, customer.CompanyName, customer.Email, customer.Phone,
                customer.BillingAddress, customer.City, customer.Country, customer.Type,
                customer.PaymentTerms, customer.CreditLimit, customer.Balance, customer.PriceGroup, null
            );

            return Success(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating customer {CustomerId}", id);
            return BadRequestResponse<CustomerDto>("Failed to update customer");
        }
    }

    /// <summary>
    /// Delete a customer (soft delete)
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            
            var customer = await _db.Customers
                .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);

            if (customer == null)
                return NotFoundResponse<bool>("Customer not found");

            // Check for unpaid invoices
            var hasUnpaidInvoices = await _db.Invoices
                .AnyAsync(i => i.CustomerId == id && !i.IsDeleted && i.Status != InvoiceStatus.Paid);

            if (hasUnpaidInvoices)
            {
                return BadRequestResponse<bool>("Cannot delete customer with unpaid invoices");
            }

            customer.IsDeleted = true;
            customer.ModifiedAt = DateTime.UtcNow;
            customer.ModifiedBy = userId.ToString();

            await _db.SaveChangesAsync();

            _logger.LogInformation("Customer {CustomerId} deleted by user {UserId}", id, userId);

            return Success(true, "Customer deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting customer {CustomerId}", id);
            return BadRequestResponse<bool>("Failed to delete customer");
        }
    }

    /// <summary>
    /// Get customer statistics
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<ApiResponse<CustomerStatsDto>>> GetStats()
    {
        try
        {
            var tenantId = GetTenantId();
            
            var stats = await _db.Customers
                .Where(c => c.TenantId == tenantId && !c.IsDeleted)
                .GroupBy(c => 1)
                .Select(g => new CustomerStatsDto
                {
                    TotalCustomers = g.Count(),
                    StandardCustomers = g.Count(c => c.Type == CustomerType.Standard),
                    PremiumCustomers = g.Count(c => c.Type == CustomerType.Premium || c.Type == CustomerType.VIP),
                    TotalBalance = g.Sum(c => c.Balance)
                })
                .FirstOrDefaultAsync() ?? new CustomerStatsDto();

            return Success(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting customer stats");
            return BadRequestResponse<CustomerStatsDto>("Failed to retrieve customer statistics");
        }
    }
}

// DTOs
public record CustomerDto(
    Guid Id,
    string Name,
    string? CompanyName,
    string? Email,
    string Phone,
    string? BillingAddress,
    string? City,
    string? Country,
    CustomerType Type,
    string PaymentTerms,
    decimal CreditLimit,
    decimal Balance,
    PriceGroup? PriceGroup,
    string? AssignedSalesRepName
);

public class CreateCustomerRequest
{
    public required string Name { get; set; }
    public string? Phone { get; set; }
    public string? CompanyName { get; set; }
    public string? Email { get; set; }
    public string? BillingAddress { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public CustomerType Type { get; set; } = CustomerType.Standard;
    public string? PaymentTerms { get; set; }
    public decimal CreditLimit { get; set; }
    public PriceGroup? PriceGroup { get; set; }
}

public class UpdateCustomerRequest
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? CompanyName { get; set; }
    public string? Email { get; set; }
    public string? BillingAddress { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public CustomerType? Type { get; set; }
    public string? PaymentTerms { get; set; }
    public decimal? CreditLimit { get; set; }
    public PriceGroup? PriceGroup { get; set; }
}

public class CustomerStatsDto
{
    public int TotalCustomers { get; set; }
    public int StandardCustomers { get; set; }
    public int PremiumCustomers { get; set; }
    public decimal TotalBalance { get; set; }
}
