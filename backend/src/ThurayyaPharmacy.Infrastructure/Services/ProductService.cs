using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Application.Mappings;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.Infrastructure.Services;

public class ProductService : IProductService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<ProductService> _logger;
    private readonly ICacheService _cache;

    public ProductService(ApplicationDbContext db, ILogger<ProductService> logger, ICacheService cache)
    {
        _db = db;
        _logger = logger;
        _cache = cache;
    }

    public async Task<PaginatedResponse<ProductDto>> GetAllAsync(
        int page,
        int pageSize,
        Guid? branchId,
        string? search,
        string? category,
        Guid? supplierId,
        bool? lowStock,
        bool? expiringSoon,
        string? sortBy,
        string sortOrder,
        CancellationToken ct)
    {
        var query = _db.Products
            .Include(p => p.Supplier)
            .Include(p => p.Batches)
            .AsQueryable();

        // Filters
        if (branchId.HasValue) query = query.Where(p => p.BranchId == branchId);
        if (!string.IsNullOrEmpty(category)) query = query.Where(p => p.Category == category);
        if (supplierId.HasValue) query = query.Where(p => p.SupplierId == supplierId);
        if (!string.IsNullOrEmpty(search))
        {
            search = search.ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(search) || 
                                     p.Sku.ToLower().Contains(search) || 
                                     p.GenericName.ToLower().Contains(search));
        }

        if (lowStock == true) query = query.Where(p => p.Stock <= p.MinStock);
        if (expiringSoon == true)
        {
            var threshold = DateTime.UtcNow.AddDays(90);
            query = query.Where(p => p.ExpiryDate <= threshold && p.ExpiryDate >= DateTime.UtcNow);
        }

        // Sorting
        query = sortOrder.ToLower() == "desc" 
            ? query.OrderByDescending(p => EF.Property<object>(p, sortBy ?? "Name"))
            : query.OrderBy(p => EF.Property<object>(p, sortBy ?? "Name"));

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => p.ToDto())
            .ToListAsync(ct);

        return PaginatedResponse<ProductDto>.Create(items, totalCount, page, pageSize);
    }

    public async Task<ProductDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var product = await _db.Products
            .Include(p => p.Supplier)
            .Include(p => p.Batches)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (product == null) throw new KeyNotFoundException("Product not found");

        return product.ToDto();
    }

    public async Task<List<ProductDto>> GetLowStockAsync(Guid? branchId, CancellationToken ct)
    {
        var query = _db.Products
            .Include(p => p.Supplier)
            .Where(p => p.Stock <= p.MinStock);

        if (branchId.HasValue) query = query.Where(p => p.BranchId == branchId);

        return await query
            .OrderBy(p => p.Stock)
            .Select(p => p.ToDto())
            .ToListAsync(ct);
    }

    public async Task<List<ProductDto>> GetExpiringAsync(Guid? branchId, int days, CancellationToken ct)
    {
        var threshold = DateTime.UtcNow.AddDays(days);
        var query = _db.Products
            .Include(p => p.Supplier)
            .Where(p => p.ExpiryDate <= threshold && p.ExpiryDate >= DateTime.UtcNow);

        if (branchId.HasValue) query = query.Where(p => p.BranchId == branchId);

        return await query
            .OrderBy(p => p.ExpiryDate)
            .Select(p => p.ToDto())
            .ToListAsync(ct);
    }

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct)
    {
        if (await _db.Products.AnyAsync(p => p.Sku == request.Sku, ct))
            throw new ArgumentException("A product with this SKU already exists");

        var product = new Product
        {
            Name = request.Name,
            GenericName = request.GenericName,
            Sku = request.Sku,
            Price = request.Price,
            Cost = request.Cost,
            Category = request.Category,
            SupplierId = request.SupplierId,
            MinStock = request.MinStock,
            Location = request.Location,
            BranchId = request.BranchId ?? Guid.Empty, // Should be set from controller context usually
            Stock = request.InitialStock,
            ExpiryDate = request.ExpiryDate,
            CreatedAt = DateTime.UtcNow
        };

        if (request.InitialStock > 0)
        {
            product.Batches.Add(new ProductBatch
            {
                BatchNumber = "INITIAL",
                Quantity = request.InitialStock,
                Cost = request.Cost,
                ExpiryDate = request.ExpiryDate ?? DateTime.UtcNow.AddYears(2),
                ReceivedDate = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            });
        }

        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);
        
        _cache.RemoveByPrefix(CacheKeys.Products);
        return product.ToDto();
    }

    public async Task<ProductDto> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken ct)
    {
        var product = await _db.Products
            .Include(p => p.Batches)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (product == null) throw new KeyNotFoundException("Product not found");

        if (request.Sku != null && request.Sku != product.Sku)
        {
            if (await _db.Products.AnyAsync(p => p.Sku == request.Sku && p.Id != id, ct))
                throw new ArgumentException("A product with this SKU already exists");
            product.Sku = request.Sku;
        }

        if (request.Name != null) product.Name = request.Name;
        if (request.GenericName != null) product.GenericName = request.GenericName;
        if (request.Price.HasValue) product.Price = request.Price.Value;
        if (request.Cost.HasValue) product.Cost = request.Cost.Value;
        if (request.Category != null) product.Category = request.Category;
        if (request.SupplierId.HasValue) product.SupplierId = request.SupplierId;
        if (request.MinStock.HasValue) product.MinStock = request.MinStock.Value;
        if (request.Location != null) product.Location = request.Location;
        if (request.ExpiryDate.HasValue) product.ExpiryDate = request.ExpiryDate;

        product.ModifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        
        _cache.RemoveByPrefix(CacheKeys.Products);
        return product.ToDto();
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var product = await _db.Products.FindAsync(new object[] { id }, ct);
        if (product == null) return false;

        product.IsDeleted = true;
        product.ModifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        
        _cache.RemoveByPrefix(CacheKeys.Products);
        return true;
    }

    public async Task<ProductStatsDto> GetStatsAsync(Guid? branchId, CancellationToken ct)
    {
        var query = _db.Products.AsQueryable();
        if (branchId.HasValue) query = query.Where(p => p.BranchId == branchId);

        var totalProducts = await query.CountAsync(ct);
        var lowStockCount = await query.CountAsync(p => p.Stock <= p.MinStock, ct);
        
        var threshold = DateTime.UtcNow.AddDays(90);
        var expiringSoonCount = await query.CountAsync(p => p.ExpiryDate <= threshold && p.ExpiryDate >= DateTime.UtcNow, ct);
        
        var totalInventoryValue = await query.SumAsync(p => (decimal?)p.Stock * p.Cost, ct) ?? 0;
        var totalCategories = await query.Select(p => p.Category).Distinct().CountAsync(ct);
        var totalSuppliers = await query.Select(p => p.SupplierId).Distinct().CountAsync(ct);

        return new ProductStatsDto(
            totalProducts,
            lowStockCount,
            expiringSoonCount,
            totalInventoryValue,
            totalCategories,
            totalSuppliers
        );
    }

    public async Task<List<string>> GetCategoriesAsync(CancellationToken ct)
    {
        return await _db.Products
            .Select(p => p.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(ct);
    }
}