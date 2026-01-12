namespace ThurayyaPharmacy.Application.DTOs;

// =============================================================================
// SETUP STATUS DTOs
// =============================================================================

/// <summary>
/// Represents the overall setup completion status for the tenant.
/// Used by the dashboard to show setup progress and guide users.
/// </summary>
/// <param name="TotalBranches">Total number of branches in the system</param>
/// <param name="BranchesWithManagers">Branches that have a manager assigned</param>
/// <param name="BranchesWithoutManagers">Branches pending manager assignment</param>
/// <param name="CompletionPercentage">0-100 percentage of branches with managers</param>
/// <param name="IsSetupComplete">True if all branches have managers (or none exist)</param>
/// <param name="RequiresAttention">True if >10% of branches lack managers</param>
public record SetupStatusDto(
    int TotalBranches,
    int BranchesWithManagers,
    int BranchesWithoutManagers,
    int CompletionPercentage,
    bool IsSetupComplete,
    bool RequiresAttention
);

/// <summary>
/// Request to assign a manager to multiple branches at once.
/// Enables bulk operations for efficient onboarding workflows.
/// </summary>
/// <param name="BranchIds">List of branch IDs to assign the manager to</param>
/// <param name="ManagerId">The user ID of the manager to assign</param>
public record BulkAssignManagerRequest(
    List<Guid> BranchIds,
    Guid ManagerId
);

/// <summary>
/// Response from bulk manager assignment operation.
/// </summary>
/// <param name="SuccessCount">Number of branches successfully updated</param>
/// <param name="FailedCount">Number of branches that failed to update</param>
/// <param name="Errors">List of error messages for failed operations</param>
public record BulkAssignManagerResponse(
    int SuccessCount,
    int FailedCount,
    List<string> Errors
);

/// <summary>
/// Lightweight DTO for manager selection dropdowns.
/// Contains only essential fields for UI performance.
/// </summary>
public record ManagerOptionDto(
    Guid Id,
    string Name,
    string Email,
    string Role,
    int AssignedBranchCount
);

// =============================================================================
// TENANT DTOs
// =============================================================================

public record TenantDto(
    Guid Id,
    string Name,
    string Slug,
    string Country,
    string Currency,
    string Language
);

/// <summary>
/// Public tenant info (no sensitive data) - used for org selection
/// </summary>
public record TenantPublicDto(
    Guid Id,
    string Name,
    string Slug
);

public record BranchDto(
    Guid Id,
    string Name,
    string Code,
    string Location,
    bool IsOfflineEnabled,
    int LicenseCount,
    Guid? ManagerId,
    string? ManagerName
);

public record CreateBranchRequest(
    string Name,
    string Code,
    string Location,
    bool IsOfflineEnabled = false,
    int LicenseCount = 1,
    Guid? ManagerId = null
);

public record UpdateBranchRequest(
    string? Name,
    string? Code,
    string? Location,
    bool? IsOfflineEnabled,
    int? LicenseCount,
    Guid? ManagerId
);

public record PagedResult<T>(
    IEnumerable<T> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
)
{
    /// <summary>
    /// Creates an empty paged result
    /// </summary>
    public static PagedResult<T> Empty(int page = 1, int pageSize = 20) =>
        new(Enumerable.Empty<T>(), 0, page, pageSize, 0);
}

/// <summary>
/// Standard API response wrapper with factory methods for clean code
/// </summary>
public record ApiResponse<T>(
    bool Success,
    T? Data,
    string? Message = null,
    IEnumerable<string>? Errors = null
)
{
    /// <summary>
    /// Creates a successful response with data
    /// </summary>
    public static ApiResponse<T> Ok(T data, string? message = null) =>
        new(true, data, message);

    /// <summary>
    /// Creates a failed response with message
    /// </summary>
    public static ApiResponse<T> Fail(string message) =>
        new(false, default, message);

    /// <summary>
    /// Creates a failed response with multiple errors
    /// </summary>
    public static ApiResponse<T> Fail(IEnumerable<string> errors) =>
        new(false, default, errors.FirstOrDefault(), errors);
}

/// <summary>
/// Standard paginated response for list endpoints
/// </summary>
public class PaginatedResponse<T>
{
    public IEnumerable<T> Items { get; set; } = Enumerable.Empty<T>();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    public bool HasNextPage => PageNumber < TotalPages;
    public bool HasPreviousPage => PageNumber > 1;

    /// <summary>
    /// Creates an empty paginated response
    /// </summary>
    public static PaginatedResponse<T> Empty(int page = 1, int pageSize = 20) => new()
    {
        Items = Enumerable.Empty<T>(),
        TotalCount = 0,
        PageNumber = page,
        PageSize = pageSize,
        TotalPages = 0
    };

    /// <summary>
    /// Creates a paginated response from items and total count
    /// </summary>
    public static PaginatedResponse<T> Create(IEnumerable<T> items, int totalCount, int page, int pageSize) => new()
    {
        Items = items,
        TotalCount = totalCount,
        PageNumber = page,
        PageSize = pageSize,
        TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
    };
}

