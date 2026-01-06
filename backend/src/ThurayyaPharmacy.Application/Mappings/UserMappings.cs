using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Application.Mappings;

/// <summary>
/// Extension methods for mapping User entities to DTOs.
/// </summary>
public static class UserMappings
{
    /// <summary>
    /// Maps a User entity to UserDto.
    /// </summary>
    public static UserDto ToDto(this User user, Branch? branch = null)
    {
        ArgumentNullException.ThrowIfNull(user);

        return new UserDto(
            user.Id,
            user.Name,
            user.Email,
            user.Role,
            user.BranchId,
            branch?.Name,
            user.Status,
            user.Avatar
        );
    }

    /// <summary>
    /// Gets a human-readable message for a user status.
    /// </summary>
    public static string GetStatusMessage(this UserStatus status) => status switch
    {
        UserStatus.Invited => "Your account is pending activation. Please check your email.",
        UserStatus.Suspended => "Your account has been suspended. Please contact support.",
        _ => "Account is not active"
    };
}
