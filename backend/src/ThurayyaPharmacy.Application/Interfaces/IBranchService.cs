using ThurayyaPharmacy.Application.DTOs;

namespace ThurayyaPharmacy.Application.Interfaces;

public interface IBranchService
{
    Task<PaginatedResponse<BranchDto>> GetAllAsync(
        int page,
        int pageSize,
        string? search,
        string? sortBy,
        string sortOrder,
        CancellationToken ct);

    Task<BranchDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<BranchDto> CreateAsync(CreateBranchRequest request, CancellationToken ct);
    Task<BranchDto> UpdateAsync(Guid id, UpdateBranchRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<List<BranchDto>> BulkCreateAsync(IEnumerable<CreateBranchRequest> requests, CancellationToken ct);
}