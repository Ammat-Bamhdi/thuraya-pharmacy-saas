using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Application.DTOs;

public record UserDto(
    Guid Id,
    string Name,
    string Email,
    UserRole Role,
    Guid? BranchId,
    string? BranchName,
    UserStatus Status,
    string? Avatar
);

public record CreateUserRequest(
    string Name,
    string Email,
    string Password,
    UserRole Role,
    Guid? BranchId
);

public record UpdateUserRequest(
    string? Name,
    string? Email,
    UserRole? Role,
    Guid? BranchId,
    UserStatus? Status
);

public record InviteUserRequest(
    string Email,
    string Name,
    string Role,
    Guid? BranchId
);
