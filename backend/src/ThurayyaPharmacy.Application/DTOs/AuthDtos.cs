namespace ThurayyaPharmacy.Application.DTOs;

public record LoginRequest(string Email, string Password);

public record RegisterRequest(
    string Name,
    string Email,
    string Password,
    string TenantName,
    string Country,
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
public record GoogleCodeRequest(string Code);

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
    public string AccessToken { get; set; } = "";
    
    [System.Text.Json.Serialization.JsonPropertyName("id_token")]
    public string IdToken { get; set; } = "";
    
    [System.Text.Json.Serialization.JsonPropertyName("refresh_token")]
    public string RefreshToken { get; set; } = "";
    
    [System.Text.Json.Serialization.JsonPropertyName("expires_in")]
    public int ExpiresIn { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("token_type")]
    public string TokenType { get; set; } = "";
    
    [System.Text.Json.Serialization.JsonPropertyName("scope")]
    public string Scope { get; set; } = "";
}

