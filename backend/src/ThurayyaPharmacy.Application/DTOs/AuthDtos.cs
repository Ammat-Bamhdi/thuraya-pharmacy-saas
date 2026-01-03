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

