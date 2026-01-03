using ThurayyaPharmacy.Domain.Common;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Domain.Entities;

/// <summary>
/// System user
/// </summary>
public class User : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.SectionAdmin;
    public Guid? BranchId { get; set; }
    public string? SectionId { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Invited;
    public string? Avatar { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
    
    // OAuth providers
    public string? GoogleId { get; set; }
    public bool EmailVerified { get; set; } = false;
    
    // Navigation
    public virtual Branch? Branch { get; set; }
}

