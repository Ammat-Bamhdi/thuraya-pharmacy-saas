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
public class InvoicesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public InvoicesController(ApplicationDbContext db)
    {
        _db = db;
    }

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")?.Value ?? throw new UnauthorizedAccessException());

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IEnumerable<InvoiceDto>>>> GetAll([FromQuery] Guid? branchId)
    {
        var tenantId = GetTenantId();
        var query = _db.Invoices
            .Include(i => i.Customer)
            .Include(i => i.Branch)
            .Include(i => i.Items).ThenInclude(item => item.Product)
            .Where(i => i.TenantId == tenantId);

        if (branchId.HasValue)
            query = query.Where(i => i.BranchId == branchId.Value);

        var invoices = await query
            .OrderByDescending(i => i.Date)
            .Select(i => new InvoiceDto(
                i.Id, i.CustomerId, i.Customer.Name, i.BranchId, i.Branch.Name,
                i.Date, i.Status, i.Total, i.PaidAmount,
                i.Items.Select(item => new InvoiceItemDto(
                    item.Id, item.ProductId, item.Product.Name, item.Quantity, item.Price
                ))
            ))
            .ToListAsync();

        return Ok(new ApiResponse<IEnumerable<InvoiceDto>>(true, invoices));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<InvoiceDto>>> GetById(Guid id)
    {
        var tenantId = GetTenantId();
        var invoice = await _db.Invoices
            .Include(i => i.Customer)
            .Include(i => i.Branch)
            .Include(i => i.Items).ThenInclude(item => item.Product)
            .Where(i => i.Id == id && i.TenantId == tenantId)
            .Select(i => new InvoiceDto(
                i.Id, i.CustomerId, i.Customer.Name, i.BranchId, i.Branch.Name,
                i.Date, i.Status, i.Total, i.PaidAmount,
                i.Items.Select(item => new InvoiceItemDto(
                    item.Id, item.ProductId, item.Product.Name, item.Quantity, item.Price
                ))
            ))
            .FirstOrDefaultAsync();

        if (invoice == null)
            return NotFound(new ApiResponse<InvoiceDto>(false, null, "Invoice not found"));

        return Ok(new ApiResponse<InvoiceDto>(true, invoice));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<InvoiceDto>>> Create([FromBody] CreateInvoiceRequest request)
    {
        var tenantId = GetTenantId();
        var userId = User.FindFirst("sub")?.Value;

        var items = request.Items?.ToList() ?? new List<CreateInvoiceItemRequest>();
        var total = items.Sum(i => i.Quantity * i.Price);

        var invoice = new Invoice
        {
            TenantId = tenantId,
            BranchId = request.BranchId,
            CustomerId = request.CustomerId,
            Date = DateTime.UtcNow,
            Status = InvoiceStatus.Pending,
            Total = total,
            CreatedBy = userId,
            Items = items.Select(i => new InvoiceItem
            {
                ProductId = i.ProductId,
                Quantity = i.Quantity,
                Price = i.Price
            }).ToList()
        };

        // Deduct stock
        foreach (var item in items)
        {
            var product = await _db.Products.FindAsync(item.ProductId);
            if (product != null)
            {
                product.Stock -= item.Quantity;
            }
        }

        _db.Invoices.Add(invoice);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = invoice.Id }, 
            new ApiResponse<InvoiceDto>(true, null, "Invoice created"));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<InvoiceDto>>> Update(Guid id, [FromBody] InvoiceStatus status)
    {
        var tenantId = GetTenantId();
        var invoice = await _db.Invoices.FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId);

        if (invoice == null)
            return NotFound(new ApiResponse<InvoiceDto>(false, null, "Invoice not found"));

        invoice.Status = status;
        if (status == InvoiceStatus.Paid)
        {
            invoice.PaidAmount = invoice.Total;
        }

        invoice.ModifiedAt = DateTime.UtcNow;
        invoice.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<InvoiceDto>(true, null, "Invoice updated"));
    }
}

