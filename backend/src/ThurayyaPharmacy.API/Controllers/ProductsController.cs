using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public ProductsController(ApplicationDbContext db)
    {
        _db = db;
    }

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")?.Value ?? throw new UnauthorizedAccessException());
    private Guid? GetBranchId() => Guid.TryParse(User.FindFirst("branchId")?.Value, out var id) ? id : null;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IEnumerable<ProductDto>>>> GetAll([FromQuery] Guid? branchId)
    {
        var tenantId = GetTenantId();
        var query = _db.Products
            .Include(p => p.Supplier)
            .Include(p => p.Batches)
            .Where(p => p.TenantId == tenantId);

        if (branchId.HasValue)
            query = query.Where(p => p.BranchId == branchId.Value);

        var products = await query
            .Select(p => new ProductDto(
                p.Id, p.BranchId, p.Name, p.GenericName, p.Sku, p.Price, p.Cost, p.Margin,
                p.Stock, p.ExpiryDate, p.Category, p.SupplierId, 
                p.Supplier != null ? p.Supplier.Name : null, p.MinStock, p.Location,
                p.Batches.Select(b => new ProductBatchDto(
                    b.Id, b.PoRef, b.BatchNumber, b.Quantity, b.Cost, b.ExpiryDate, b.ReceivedDate
                ))
            ))
            .ToListAsync();

        return Ok(new ApiResponse<IEnumerable<ProductDto>>(true, products));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProductDto>>> GetById(Guid id)
    {
        var tenantId = GetTenantId();
        var product = await _db.Products
            .Include(p => p.Supplier)
            .Include(p => p.Batches)
            .Where(p => p.Id == id && p.TenantId == tenantId)
            .Select(p => new ProductDto(
                p.Id, p.BranchId, p.Name, p.GenericName, p.Sku, p.Price, p.Cost, p.Margin,
                p.Stock, p.ExpiryDate, p.Category, p.SupplierId, 
                p.Supplier != null ? p.Supplier.Name : null, p.MinStock, p.Location,
                p.Batches.Select(b => new ProductBatchDto(
                    b.Id, b.PoRef, b.BatchNumber, b.Quantity, b.Cost, b.ExpiryDate, b.ReceivedDate
                ))
            ))
            .FirstOrDefaultAsync();

        if (product == null)
            return NotFound(new ApiResponse<ProductDto>(false, null, "Product not found"));

        return Ok(new ApiResponse<ProductDto>(true, product));
    }

    [HttpGet("low-stock")]
    public async Task<ActionResult<ApiResponse<IEnumerable<ProductDto>>>> GetLowStock([FromQuery] Guid? branchId)
    {
        var tenantId = GetTenantId();
        var query = _db.Products
            .Include(p => p.Supplier)
            .Where(p => p.TenantId == tenantId && p.Stock <= p.MinStock);

        if (branchId.HasValue)
            query = query.Where(p => p.BranchId == branchId.Value);

        var products = await query
            .Select(p => new ProductDto(
                p.Id, p.BranchId, p.Name, p.GenericName, p.Sku, p.Price, p.Cost, p.Margin,
                p.Stock, p.ExpiryDate, p.Category, p.SupplierId, 
                p.Supplier != null ? p.Supplier.Name : null, p.MinStock, p.Location,
                Enumerable.Empty<ProductBatchDto>()
            ))
            .ToListAsync();

        return Ok(new ApiResponse<IEnumerable<ProductDto>>(true, products));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ProductDto>>> Create([FromBody] CreateProductRequest request, [FromQuery] Guid branchId)
    {
        var tenantId = GetTenantId();
        
        var product = new Product
        {
            TenantId = tenantId,
            BranchId = branchId,
            Name = request.Name,
            GenericName = request.GenericName,
            Sku = request.Sku,
            Price = request.Price,
            Cost = request.Cost,
            Margin = request.Price > 0 ? ((request.Price - request.Cost) / request.Price) * 100 : 0,
            Category = request.Category,
            SupplierId = request.SupplierId,
            MinStock = request.MinStock,
            Location = request.Location,
            CreatedBy = User.FindFirst("sub")?.Value
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        var dto = new ProductDto(
            product.Id, product.BranchId, product.Name, product.GenericName, product.Sku,
            product.Price, product.Cost, product.Margin, product.Stock, product.ExpiryDate,
            product.Category, product.SupplierId, null, product.MinStock, product.Location,
            Enumerable.Empty<ProductBatchDto>()
        );

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, new ApiResponse<ProductDto>(true, dto));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProductDto>>> Update(Guid id, [FromBody] UpdateProductRequest request)
    {
        var tenantId = GetTenantId();
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId);

        if (product == null)
            return NotFound(new ApiResponse<ProductDto>(false, null, "Product not found"));

        if (request.Name != null) product.Name = request.Name;
        if (request.GenericName != null) product.GenericName = request.GenericName;
        if (request.Sku != null) product.Sku = request.Sku;
        if (request.Price.HasValue) product.Price = request.Price.Value;
        if (request.Cost.HasValue) product.Cost = request.Cost.Value;
        if (request.Category != null) product.Category = request.Category;
        if (request.SupplierId.HasValue) product.SupplierId = request.SupplierId;
        if (request.MinStock.HasValue) product.MinStock = request.MinStock.Value;
        if (request.Location != null) product.Location = request.Location;

        // Recalculate margin
        product.Margin = product.Price > 0 ? ((product.Price - product.Cost) / product.Price) * 100 : 0;

        product.ModifiedAt = DateTime.UtcNow;
        product.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        var dto = new ProductDto(
            product.Id, product.BranchId, product.Name, product.GenericName, product.Sku,
            product.Price, product.Cost, product.Margin, product.Stock, product.ExpiryDate,
            product.Category, product.SupplierId, null, product.MinStock, product.Location,
            Enumerable.Empty<ProductBatchDto>()
        );

        return Ok(new ApiResponse<ProductDto>(true, dto));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id)
    {
        var tenantId = GetTenantId();
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId);

        if (product == null)
            return NotFound(new ApiResponse<bool>(false, false, "Product not found"));

        product.IsDeleted = true;
        product.ModifiedAt = DateTime.UtcNow;
        product.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<bool>(true, true, "Product deleted"));
    }
}

