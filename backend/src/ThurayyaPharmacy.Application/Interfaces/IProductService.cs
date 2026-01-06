using ThurayyaPharmacy.Application.DTOs;

namespace ThurayyaPharmacy.Application.Interfaces;

public interface IProductService
{
    Task<PaginatedResponse<ProductDto>> GetAllAsync(
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
        CancellationToken ct);

    Task<ProductDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<List<ProductDto>> GetLowStockAsync(Guid? branchId, CancellationToken ct);
    Task<List<ProductDto>> GetExpiringAsync(Guid? branchId, int days, CancellationToken ct);
    Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct);
    Task<ProductDto> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<ProductStatsDto> GetStatsAsync(Guid? branchId, CancellationToken ct);
    Task<List<string>> GetCategoriesAsync(CancellationToken ct);
}