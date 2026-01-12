using System.ComponentModel.DataAnnotations;

namespace ThurayyaPharmacy.Application.DTOs;

public record LoginRequest(
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    string Email,
    
    [Required(ErrorMessage = "Password is required")]
    string Password,
    
    /// <summary>
    /// Optional tenant slug for tenant-first auth flow.
    /// When provided, validates user belongs to this organization.
    /// </summary>
    string? TenantSlug = null
);

public record RegisterRequest(
    [Required(ErrorMessage = "Name is required")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 200 characters")]
    string Name,
    
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    string Email,
    
    [Required(ErrorMessage = "Password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    string Password,
    
    [Required(ErrorMessage = "Organization name is required")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "Organization name must be between 2 and 200 characters")]
    string TenantName,
    
    [Required(ErrorMessage = "Country is required")]
    [StringLength(100)]
    string Country,
    
    [Required(ErrorMessage = "Currency is required")]
    [StringLength(10)]
    string Currency
);

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    UserDto User
);

public record RefreshTokenRequest(string RefreshToken);

/// <summary>
/// Request for Google OAuth authentication
/// </summary>
public record GoogleAuthRequest(
    string Credential,           // Google ID token (JWT from Google Sign-In)
    string? TenantSlug = null,   // For existing org login (tenant-first flow)
    bool IsNewOrg = false,       // True if creating new org (signup flow)
    string? TenantName = null,   // Required for new user registration
    string? Country = null,      // Required for new user registration
    string? Currency = null      // Required for new user registration
);

/// <summary>
/// Response indicating if user is new (needs onboarding) or existing
/// </summary>
public record GoogleAuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    UserDto User,
    bool IsNewUser,              // True if this is first login (needs onboarding)
    TenantDto? Tenant = null     // Tenant info for immediate UI update
);

/// <summary>
/// Request for Google authorization code (popup flow)
/// </summary>
/// <param name="Code">The authorization code from Google</param>
/// <param name="TenantSlug">Required for existing org login - validates user belongs to this org</param>
/// <param name="IsNewOrg">True if user is creating a new organization (skips tenant validation)</param>
public record GoogleCodeRequest(
    string Code,
    string? TenantSlug = null,
    bool IsNewOrg = false
);

/// <summary>
/// Full user info with tenant for /auth/me endpoint
/// </summary>
public record MeResponse(
    UserDto User,
    TenantDto? Tenant
);

/// <summary>
/// Response from Google token endpoint
/// </summary>
public class GoogleTokenResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("access_token")]
    public string? AccessToken { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("id_token")]
    public string? IdToken { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("refresh_token")]
    public string? RefreshToken { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("expires_in")]
    public int ExpiresIn { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("token_type")]
    public string TokenType { get; set; } = "";
    
    [System.Text.Json.Serialization.JsonPropertyName("scope")]
    public string Scope { get; set; } = "";
}

