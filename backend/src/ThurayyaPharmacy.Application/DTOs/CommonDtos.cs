namespace ThurayyaPharmacy.Application.DTOs;

public record TenantDto(
    Guid Id,
    string Name,
    string Country,
    string Currency,
    string Language
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

