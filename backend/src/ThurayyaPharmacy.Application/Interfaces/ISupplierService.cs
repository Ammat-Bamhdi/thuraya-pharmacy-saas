using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Application.Interfaces;

public interface ISupplierService
{
    Task<PaginatedResponse<SupplierDto>> GetAllAsync(
        int page,
        int pageSize,
        string? search,
        SupplierStatus? status,
        string? category,
        string? sortBy,
        string sortOrder,
        CancellationToken ct);

    Task<SupplierDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SupplierDto> CreateAsync(CreateSupplierRequest request, CancellationToken ct);
    Task<SupplierDto> UpdateAsync(Guid id, UpdateSupplierRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<SupplierStatsDto> GetStatsAsync(CancellationToken ct);
}