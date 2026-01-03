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
);

public record ApiResponse<T>(
    bool Success,
    T? Data,
    string? Message = null,
    IEnumerable<string>? Errors = null
);

