using ThurayyaPharmacy.Application.DTOs;

namespace ThurayyaPharmacy.Application.Interfaces;

/// <summary>
/// Service interface for branch management operations.
/// Supports CRUD, bulk operations, and setup status tracking.
/// </summary>
public interface IBranchService
{
    // =========================================================================
    // CRUD Operations
    // =========================================================================

    /// <summary>
    /// Retrieves all branches with pagination, search, and sorting.
    /// </summary>
    Task<PaginatedResponse<BranchDto>> GetAllAsync(
        int page,
        int pageSize,
        string? search,
        string? sortBy,
        string sortOrder,
        CancellationToken ct);

    /// <summary>
    /// Retrieves a single branch by ID.
    /// </summary>
    Task<BranchDto> GetByIdAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Creates a new branch.
    /// </summary>
    Task<BranchDto> CreateAsync(CreateBranchRequest request, CancellationToken ct);

    /// <summary>
    /// Updates an existing branch.
    /// </summary>
    Task<BranchDto> UpdateAsync(Guid id, UpdateBranchRequest request, CancellationToken ct);

    /// <summary>
    /// Soft deletes a branch.
    /// </summary>
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);

    // =========================================================================
    // Bulk Operations
    // =========================================================================

    /// <summary>
    /// Bulk creates branches with optimized batch processing.
    /// Uses transactions for atomicity - all or nothing.
    /// </summary>
    Task<List<BranchDto>> BulkCreateAsync(IEnumerable<CreateBranchRequest> requests, CancellationToken ct);

    /// <summary>
    /// Assigns a manager to multiple branches at once.
    /// Validates manager exists and has appropriate role.
    /// </summary>
    Task<BulkAssignManagerResponse> BulkAssignManagerAsync(BulkAssignManagerRequest request, CancellationToken ct);

    // =========================================================================
    // Setup Status Operations
    // =========================================================================

    /// <summary>
    /// Gets the current setup status showing manager assignment completion.
    /// Used by dashboard to display setup progress card.
    /// </summary>
    Task<SetupStatusDto> GetSetupStatusAsync(CancellationToken ct);

    /// <summary>
    /// Retrieves branches that don't have a manager assigned.
    /// Supports pagination for handling large numbers of branches.
    /// </summary>
    Task<PaginatedResponse<BranchDto>> GetBranchesWithoutManagerAsync(
        int page,
        int pageSize,
        string? search,
        CancellationToken ct);

    /// <summary>
    /// Gets available users who can be assigned as branch managers.
    /// Returns lightweight DTOs optimized for dropdown selection.
    /// </summary>
    Task<List<ManagerOptionDto>> GetAvailableManagersAsync(CancellationToken ct);
}