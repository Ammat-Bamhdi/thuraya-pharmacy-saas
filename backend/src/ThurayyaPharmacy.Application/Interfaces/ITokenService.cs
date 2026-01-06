using ThurayyaPharmacy.Domain.Entities;

namespace ThurayyaPharmacy.Application.Interfaces;

/// <summary>
/// Service for generating and managing JWT tokens and refresh tokens.
/// </summary>
public interface ITokenService
{
    /// <summary>
    /// Generates a new JWT access token for the user.
    /// </summary>
    /// <param name="user">The user to generate the token for.</param>
    /// <param name="tenantId">The tenant ID to include in claims.</param>
    /// <returns>The token string and expiration time.</returns>
    (string Token, DateTime ExpiresAt) GenerateAccessToken(User user, Guid tenantId);

    /// <summary>
    /// Generates a cryptographically secure refresh token.
    /// </summary>
    /// <returns>A base64-encoded refresh token string.</returns>
    string GenerateRefreshToken();
}
