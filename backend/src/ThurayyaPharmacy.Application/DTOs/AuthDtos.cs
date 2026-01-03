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
    bool IsNewUser               // True if this is first login (needs onboarding)
);

