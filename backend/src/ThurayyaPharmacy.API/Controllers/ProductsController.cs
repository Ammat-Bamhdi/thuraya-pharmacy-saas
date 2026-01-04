using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[Authorize]
public class ProductsController : BaseApiController
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<ProductsController> _logger;

    public ProductsController(ApplicationDbContext db, ILogger<ProductsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get all products with pagination and filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<ProductDto>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] bool? lowStock = null,
        [FromQuery] bool? expiringSoon = null,
        [FromQuery] string? sortBy = "Name",
        [FromQuery] string sortOrder = "asc")
    {
        try
        {
            var tenantId = GetTenantId();
            
            var query = _db.Products
                .Include(p => p.Supplier)
                .Where(p => p.TenantId == tenantId && !p.IsDeleted)
                .AsQueryable();

            // Branch filter (use user's branch if not specified)
            if (branchId.HasValue)
            {
                query = query.Where(p => p.BranchId == branchId.Value);
            }
            else
            {
                var userBranchId = GetBranchId();
                if (userBranchId.HasValue)
                {
                    query = query.Where(p => p.BranchId == userBranchId.Value);
                }
            }

            // Search filter
            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(p =>
                    p.Name.ToLower().Contains(search) ||
                    p.Sku.ToLower().Contains(search) ||
                    p.GenericName.ToLower().Contains(search));
            }

            // Category filter
            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(p => p.Category == category);
            }

            // Supplier filter
            if (supplierId.HasValue)
            {
                query = query.Where(p => p.SupplierId == supplierId.Value);
            }

            // Low stock filter
            if (lowStock == true)
            {
                query = query.Where(p => p.Stock <= p.MinStock);
            }

            // Expiring soon filter (within 90 days)
            if (expiringSoon == true)
            {
                var expiryThreshold = DateTime.UtcNow.AddDays(90);
                query = query.Where(p => p.ExpiryDate.HasValue && p.ExpiryDate <= expiryThreshold);
            }

            // Sorting
            query = sortBy?.ToLower() switch
            {
                "sku" => sortOrder == "desc" ? query.OrderByDescending(p => p.Sku) : query.OrderBy(p => p.Sku),
                "price" => sortOrder == "desc" ? query.OrderByDescending(p => p.Price) : query.OrderBy(p => p.Price),
                "stock" => sortOrder == "desc" ? query.OrderByDescending(p => p.Stock) : query.OrderBy(p => p.Stock),
                "category" => sortOrder == "desc" ? query.OrderByDescending(p => p.Category) : query.OrderBy(p => p.Category),
                "expiry" => sortOrder == "desc" ? query.OrderByDescending(p => p.ExpiryDate) : query.OrderBy(p => p.ExpiryDate),
                _ => sortOrder == "desc" ? query.OrderByDescending(p => p.Name) : query.OrderBy(p => p.Name)
            };

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var products = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new ProductDto(
                    p.Id, p.BranchId, p.Name, p.GenericName, p.Sku, p.Price, p.Cost, p.Margin,
                    p.Stock, p.ExpiryDate, p.Category, p.SupplierId,
                    p.Supplier != null ? p.Supplier.Name : null, p.MinStock, p.Location,
                    p.Batches.Select(b => new ProductBatchDto(
                        b.Id, b.PoRef, b.BatchNumber, b.Quantity, b.Cost, b.ExpiryDate, b.ReceivedDate
                    ))
                ))
                .ToListAsync();

            var result = new PaginatedResponse<ProductDto>
            {
                Items = products,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize,
                TotalPages = totalPages
            };

            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting products");
            return BadRequestResponse<PaginatedResponse<ProductDto>>("Failed to retrieve products");
        }
    }

    /// <summary>
    /// Get a specific product by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProductDto>>> GetById(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var product = await _db.Products
                .Include(p => p.Supplier)
                .Include(p => p.Batches)
                .Where(p => p.Id == id && p.TenantId == tenantId && !p.IsDeleted)
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
                return NotFoundResponse<ProductDto>("Product not found");

            return Success(product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product {ProductId}", id);
            return BadRequestResponse<ProductDto>("Failed to retrieve product");
        }
    }

    /// <summary>
    /// Get low stock products
    /// </summary>
    [HttpGet("low-stock")]
    public async Task<ActionResult<ApiResponse<List<ProductDto>>>> GetLowStock([FromQuery] Guid? branchId)
    {
        try
        {
            var tenantId = GetTenantId();
            var query = _db.Products
                .Include(p => p.Supplier)
                .Where(p => p.TenantId == tenantId && !p.IsDeleted && p.Stock <= p.MinStock);

            if (branchId.HasValue)
            {
                query = query.Where(p => p.BranchId == branchId.Value);
            }

            var products = await query
                .OrderBy(p => p.Stock)
                .Take(100)
                .Select(p => new ProductDto(
                    p.Id, p.BranchId, p.Name, p.GenericName, p.Sku, p.Price, p.Cost, p.Margin,
                    p.Stock, p.ExpiryDate, p.Category, p.SupplierId,
                    p.Supplier != null ? p.Supplier.Name : null, p.MinStock, p.Location,
                    Enumerable.Empty<ProductBatchDto>()
                ))
                .ToListAsync();

            return Success(products);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting low stock products");
            return BadRequestResponse<List<ProductDto>>("Failed to retrieve low stock products");
        }
    }

    /// <summary>
    /// Get expiring products (within 90 days)
    /// </summary>
    [HttpGet("expiring")]
    public async Task<ActionResult<ApiResponse<List<ProductDto>>>> GetExpiring([FromQuery] Guid? branchId, [FromQuery] int days = 90)
    {
        try
        {
            var tenantId = GetTenantId();
            var expiryThreshold = DateTime.UtcNow.AddDays(days);
            
            var query = _db.Products
                .Include(p => p.Supplier)
                .Where(p => p.TenantId == tenantId && !p.IsDeleted && 
                    p.ExpiryDate.HasValue && p.ExpiryDate <= expiryThreshold);

            if (branchId.HasValue)
            {
                query = query.Where(p => p.BranchId == branchId.Value);
            }

            var products = await query
                .OrderBy(p => p.ExpiryDate)
                .Take(100)
                .Select(p => new ProductDto(
                    p.Id, p.BranchId, p.Name, p.GenericName, p.Sku, p.Price, p.Cost, p.Margin,
                    p.Stock, p.ExpiryDate, p.Category, p.SupplierId,
                    p.Supplier != null ? p.Supplier.Name : null, p.MinStock, p.Location,
                    Enumerable.Empty<ProductBatchDto>()
                ))
                .ToListAsync();

            return Success(products);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting expiring products");
            return BadRequestResponse<List<ProductDto>>("Failed to retrieve expiring products");
        }
    }

    /// <summary>
    /// Create a new product
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<ProductDto>>> Create([FromBody] CreateProductRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();

            // Use provided branchId or user's branch
            var branchId = request.BranchId ?? GetBranchId();
            if (!branchId.HasValue)
            {
                // Get the first branch for the tenant
                var defaultBranch = await _db.Branches
                    .FirstOrDefaultAsync(b => b.TenantId == tenantId && !b.IsDeleted);
                branchId = defaultBranch?.Id;
            }

            if (!branchId.HasValue)
            {
                return BadRequestResponse<ProductDto>("Branch ID is required");
            }

            // Check for duplicate SKU
            var existingSku = await _db.Products
                .AnyAsync(p => p.TenantId == tenantId && p.Sku == request.Sku && !p.IsDeleted);

            if (existingSku)
            {
                return BadRequestResponse<ProductDto>("A product with this SKU already exists");
            }

            var product = new Product
            {
                TenantId = tenantId,
                BranchId = branchId.Value,
                Name = request.Name,
                GenericName = request.GenericName ?? "",
                Sku = request.Sku,
                Price = request.Price,
                Cost = request.Cost,
                Margin = request.Price > 0 ? ((request.Price - request.Cost) / request.Price) * 100 : 0,
                Stock = request.InitialStock,
                Category = request.Category ?? "General",
                SupplierId = request.SupplierId,
                MinStock = request.MinStock,
                Location = request.Location ?? "",
                ExpiryDate = request.ExpiryDate,
                CreatedBy = userId.ToString()
            };

            _db.Products.Add(product);

            // Create initial batch if there's initial stock
            if (request.InitialStock > 0)
            {
                var batch = new ProductBatch
                {
                    ProductId = product.Id,
                    PoRef = "INITIAL-STOCK",
                    BatchNumber = $"BATCH-{DateTime.UtcNow:yyyyMMdd}",
                    Quantity = request.InitialStock,
                    Cost = request.Cost,
                    ExpiryDate = request.ExpiryDate ?? DateTime.UtcNow.AddYears(2),
                    ReceivedDate = DateTime.UtcNow
                };
                _db.Set<ProductBatch>().Add(batch);
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation("Product {ProductId} created by user {UserId}", product.Id, userId);

            var dto = new ProductDto(
                product.Id, product.BranchId, product.Name, product.GenericName, product.Sku,
                product.Price, product.Cost, product.Margin, product.Stock, product.ExpiryDate,
                product.Category, product.SupplierId, null, product.MinStock, product.Location,
                Enumerable.Empty<ProductBatchDto>()
            );

            return Created(dto, nameof(GetById), new { id = product.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating product");
            return BadRequestResponse<ProductDto>("Failed to create product");
        }
    }

    /// <summary>
    /// Update an existing product
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProductDto>>> Update(Guid id, [FromBody] UpdateProductRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            
            var product = await _db.Products
                .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId && !p.IsDeleted);

            if (product == null)
                return NotFoundResponse<ProductDto>("Product not found");

            // Check for duplicate SKU if changing
            if (request.Sku != null && request.Sku != product.Sku)
            {
                var existingSku = await _db.Products
                    .AnyAsync(p => p.TenantId == tenantId && p.Sku == request.Sku && p.Id != id && !p.IsDeleted);

                if (existingSku)
                {
                    return BadRequestResponse<ProductDto>("A product with this SKU already exists");
                }
            }

            if (request.Name != null) product.Name = request.Name;
            if (request.GenericName != null) product.GenericName = request.GenericName;
            if (request.Sku != null) product.Sku = request.Sku;
            if (request.Price.HasValue) product.Price = request.Price.Value;
            if (request.Cost.HasValue) product.Cost = request.Cost.Value;
            if (request.Category != null) product.Category = request.Category;
            if (request.SupplierId.HasValue) product.SupplierId = request.SupplierId;
            if (request.MinStock.HasValue) product.MinStock = request.MinStock.Value;
            if (request.Location != null) product.Location = request.Location;
            if (request.ExpiryDate.HasValue) product.ExpiryDate = request.ExpiryDate;

            // Recalculate margin
            product.Margin = product.Price > 0 ? ((product.Price - product.Cost) / product.Price) * 100 : 0;

            product.ModifiedAt = DateTime.UtcNow;
            product.ModifiedBy = userId.ToString();

            await _db.SaveChangesAsync();

            _logger.LogInformation("Product {ProductId} updated by user {UserId}", id, userId);

            var dto = new ProductDto(
                product.Id, product.BranchId, product.Name, product.GenericName, product.Sku,
                product.Price, product.Cost, product.Margin, product.Stock, product.ExpiryDate,
                product.Category, product.SupplierId, null, product.MinStock, product.Location,
                Enumerable.Empty<ProductBatchDto>()
            );

            return Success(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating product {ProductId}", id);
            return BadRequestResponse<ProductDto>("Failed to update product");
        }
    }

    /// <summary>
    /// Delete a product (soft delete)
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            
            var product = await _db.Products
                .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId && !p.IsDeleted);

            if (product == null)
                return NotFoundResponse<bool>("Product not found");

            product.IsDeleted = true;
            product.ModifiedAt = DateTime.UtcNow;
            product.ModifiedBy = userId.ToString();

            await _db.SaveChangesAsync();

            _logger.LogInformation("Product {ProductId} deleted by user {UserId}", id, userId);

            return Success(true, "Product deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting product {ProductId}", id);
            return BadRequestResponse<bool>("Failed to delete product");
        }
    }

    /// <summary>
    /// Get product statistics
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<ApiResponse<ProductStatsDto>>> GetStats([FromQuery] Guid? branchId)
    {
        try
        {
            var tenantId = GetTenantId();
            var expiryThreshold = DateTime.UtcNow.AddDays(90);
            
            var query = _db.Products.Where(p => p.TenantId == tenantId && !p.IsDeleted);
            
            if (branchId.HasValue)
            {
                query = query.Where(p => p.BranchId == branchId.Value);
            }

            var stats = await query
                .GroupBy(p => 1)
                .Select(g => new ProductStatsDto
                {
                    TotalProducts = g.Count(),
                    LowStockCount = g.Count(p => p.Stock <= p.MinStock),
                    ExpiringCount = g.Count(p => p.ExpiryDate.HasValue && p.ExpiryDate <= expiryThreshold),
                    TotalStockValue = g.Sum(p => p.Stock * p.Cost),
                    AverageMargin = g.Average(p => p.Margin)
                })
                .FirstOrDefaultAsync() ?? new ProductStatsDto();

            return Success(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product stats");
            return BadRequestResponse<ProductStatsDto>("Failed to retrieve product statistics");
        }
    }

    /// <summary>
    /// Get distinct categories
    /// </summary>
    [HttpGet("categories")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetCategories()
    {
        try
        {
            var tenantId = GetTenantId();
            
            var categories = await _db.Products
                .Where(p => p.TenantId == tenantId && !p.IsDeleted)
                .Select(p => p.Category)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            return Success(categories);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting categories");
            return BadRequestResponse<List<string>>("Failed to retrieve categories");
        }
    }
}

// DTOs
public record ProductDto(
    Guid Id,
    Guid BranchId,
    string Name,
    string GenericName,
    string Sku,
    decimal Price,
    decimal Cost,
    decimal Margin,
    int Stock,
    DateTime? ExpiryDate,
    string Category,
    Guid? SupplierId,
    string? SupplierName,
    int MinStock,
    string Location,
    IEnumerable<ProductBatchDto> Batches
);

public record ProductBatchDto(
    Guid Id,
    string PoRef,
    string BatchNumber,
    int Quantity,
    decimal Cost,
    DateTime ExpiryDate,
    DateTime ReceivedDate
);

public class CreateProductRequest
{
    public Guid? BranchId { get; set; }
    public required string Name { get; set; }
    public string? GenericName { get; set; }
    public required string Sku { get; set; }
    public required decimal Price { get; set; }
    public required decimal Cost { get; set; }
    public string? Category { get; set; }
    public Guid? SupplierId { get; set; }
    public int MinStock { get; set; } = 10;
    public string? Location { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public int InitialStock { get; set; } = 0;
}

public class UpdateProductRequest
{
    public string? Name { get; set; }
    public string? GenericName { get; set; }
    public string? Sku { get; set; }
    public decimal? Price { get; set; }
    public decimal? Cost { get; set; }
    public string? Category { get; set; }
    public Guid? SupplierId { get; set; }
    public int? MinStock { get; set; }
    public string? Location { get; set; }
    public DateTime? ExpiryDate { get; set; }
}

public class ProductStatsDto
{
    public int TotalProducts { get; set; }
    public int LowStockCount { get; set; }
    public int ExpiringCount { get; set; }
    public decimal TotalStockValue { get; set; }
    public decimal AverageMargin { get; set; }
}
