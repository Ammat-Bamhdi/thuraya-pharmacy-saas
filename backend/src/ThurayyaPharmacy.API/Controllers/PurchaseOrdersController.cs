using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[Route("api/purchase-orders")]
[Authorize]
public class PurchaseOrdersController : BaseApiController
{
    private readonly ApplicationDbContext _db;

    public PurchaseOrdersController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IEnumerable<PurchaseOrderDto>>>> GetAll([FromQuery] Guid? branchId)
    {
        var tenantId = GetTenantId();
        var query = _db.PurchaseOrders
            .Include(po => po.Supplier)
            .Include(po => po.Branch)
            .Include(po => po.Items).ThenInclude(i => i.Product)
            .Where(po => po.TenantId == tenantId);

        if (branchId.HasValue)
            query = query.Where(po => po.BranchId == branchId.Value);

        var orders = await query
            .OrderByDescending(po => po.Date)
            .Select(po => new PurchaseOrderDto(
                po.Id, po.SupplierId, po.Supplier.Name, po.BranchId, po.Branch.Name,
                po.Date, po.ExpectedDeliveryDate, po.Status, po.SubTotal, po.Tax,
                po.Discount, po.GrandTotal, po.CreatedBy, po.AssignedTo != null ? po.AssignedTo.Name : null,
                po.Items.Select(i => new PurchaseOrderItemDto(
                    i.Id, i.ProductId, i.Product.Name, i.Quantity, i.UnitCost, i.BatchNumber, i.ExpiryDate
                ))
            ))
            .ToListAsync();

        return Ok(new ApiResponse<IEnumerable<PurchaseOrderDto>>(true, orders));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<PurchaseOrderDto>>> GetById(Guid id)
    {
        var tenantId = GetTenantId();
        var order = await _db.PurchaseOrders
            .Include(po => po.Supplier)
            .Include(po => po.Branch)
            .Include(po => po.Items).ThenInclude(i => i.Product)
            .Where(po => po.Id == id && po.TenantId == tenantId)
            .Select(po => new PurchaseOrderDto(
                po.Id, po.SupplierId, po.Supplier.Name, po.BranchId, po.Branch.Name,
                po.Date, po.ExpectedDeliveryDate, po.Status, po.SubTotal, po.Tax,
                po.Discount, po.GrandTotal, po.CreatedBy, po.AssignedTo != null ? po.AssignedTo.Name : null,
                po.Items.Select(i => new PurchaseOrderItemDto(
                    i.Id, i.ProductId, i.Product.Name, i.Quantity, i.UnitCost, i.BatchNumber, i.ExpiryDate
                ))
            ))
            .FirstOrDefaultAsync();

        if (order == null)
            return NotFound(new ApiResponse<PurchaseOrderDto>(false, null, "Purchase order not found"));

        return Ok(new ApiResponse<PurchaseOrderDto>(true, order));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<PurchaseOrderDto>>> Create([FromBody] CreatePurchaseOrderRequest request)
    {
        var tenantId = GetTenantId();
        var userId = User.FindFirst("sub")?.Value;

        var items = request.Items?.ToList() ?? new List<CreatePurchaseOrderItemRequest>();
        var subTotal = items.Sum(i => i.Quantity * i.UnitCost);
        var grandTotal = subTotal + request.Tax - request.Discount;

        var order = new PurchaseOrder
        {
            TenantId = tenantId,
            BranchId = request.BranchId,
            SupplierId = request.SupplierId,
            Date = DateTime.UtcNow,
            ExpectedDeliveryDate = request.ExpectedDeliveryDate,
            Status = POStatus.Draft,
            SubTotal = subTotal,
            Tax = request.Tax,
            Discount = request.Discount,
            GrandTotal = grandTotal,
            TermsConditions = request.TermsConditions,
            ShippingAddress = request.ShippingAddress,
            AssignedToId = request.AssignedToId,
            CreatedBy = userId,
            Items = items.Select(i => new PurchaseOrderItem
            {
                ProductId = i.ProductId,
                Quantity = i.Quantity,
                UnitCost = i.UnitCost,
                BatchNumber = i.BatchNumber,
                ExpiryDate = i.ExpiryDate
            }).ToList()
        };

        _db.PurchaseOrders.Add(order);
        await _db.SaveChangesAsync();

        // Update supplier last order date
        var supplier = await _db.Suppliers.FindAsync(request.SupplierId);
        if (supplier != null)
        {
            supplier.LastOrderDate = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetById), new { id = order.Id }, 
            new ApiResponse<PurchaseOrderDto>(true, null, "Purchase order created"));
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<ApiResponse<PurchaseOrderDto>>> Approve(Guid id)
    {
        var tenantId = GetTenantId();
        var order = await _db.PurchaseOrders.FirstOrDefaultAsync(po => po.Id == id && po.TenantId == tenantId);

        if (order == null)
            return NotFound(new ApiResponse<PurchaseOrderDto>(false, null, "Purchase order not found"));

        order.Status = POStatus.Sent;
        order.ModifiedAt = DateTime.UtcNow;
        order.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<PurchaseOrderDto>(true, null, "Purchase order approved"));
    }

    [HttpPost("{id:guid}/receive")]
    public async Task<ActionResult<ApiResponse<PurchaseOrderDto>>> Receive(Guid id)
    {
        var tenantId = GetTenantId();
        var order = await _db.PurchaseOrders
            .Include(po => po.Items)
            .FirstOrDefaultAsync(po => po.Id == id && po.TenantId == tenantId);

        if (order == null)
            return NotFound(new ApiResponse<PurchaseOrderDto>(false, null, "Purchase order not found"));

        // Update product stock and create batches
        foreach (var item in order.Items)
        {
            var product = await _db.Products.FindAsync(item.ProductId);
            if (product != null)
            {
                product.Stock += item.Quantity;
                
                // Create batch
                var batch = new ProductBatch
                {
                    ProductId = product.Id,
                    PoRef = order.Id.ToString(),
                    BatchNumber = item.BatchNumber ?? $"BATCH-{DateTime.UtcNow:yyyyMMdd}",
                    Quantity = item.Quantity,
                    Cost = item.UnitCost,
                    ExpiryDate = item.ExpiryDate ?? DateTime.UtcNow.AddYears(2),
                    ReceivedDate = DateTime.UtcNow
                };
                _db.ProductBatches.Add(batch);
            }
        }

        order.Status = POStatus.Closed;
        order.ModifiedAt = DateTime.UtcNow;
        order.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<PurchaseOrderDto>(true, null, "Purchase order received and stock updated"));
    }
}

