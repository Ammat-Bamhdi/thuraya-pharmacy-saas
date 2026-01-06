using ThurayyaPharmacy.Application.DTOs;

namespace ThurayyaPharmacy.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct);
    Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request, CancellationToken ct);
    Task<GoogleAuthResponse> GoogleAuthAsync(GoogleAuthRequest request, CancellationToken ct);
    Task<GoogleAuthResponse> GoogleAuthWithCodeAsync(string code, CancellationToken ct);
    Task<MeResponse> GetMeAsync(Guid userId, CancellationToken ct);
    Task LogoutAsync(Guid userId, CancellationToken ct);
}