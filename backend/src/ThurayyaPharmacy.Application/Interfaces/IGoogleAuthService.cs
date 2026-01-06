namespace ThurayyaPharmacy.Application.Interfaces;

/// <summary>
/// Service for Google OAuth operations.
/// </summary>
public interface IGoogleAuthService
{
    /// <summary>
    /// Verifies a Google ID token and returns the payload if valid.
    /// </summary>
    /// <param name="idToken">The Google ID token to verify.</param>
    /// <returns>The token payload if valid, null otherwise.</returns>
    Task<GoogleUserInfo?> VerifyTokenAsync(string idToken);

    /// <summary>
    /// Exchanges an authorization code for tokens.
    /// </summary>
    /// <param name="code">The authorization code from Google OAuth flow.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The token response if successful, null otherwise.</returns>
    Task<GoogleTokenResponse?> ExchangeCodeForTokensAsync(string code, CancellationToken cancellationToken = default);
}

/// <summary>
/// User information from Google OAuth.
/// </summary>
public sealed record GoogleUserInfo
{
    public string Subject { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public bool EmailVerified { get; init; }
    public string? Name { get; init; }
    public string? Picture { get; init; }
}

/// <summary>
/// Response from Google's token endpoint.
/// </summary>
public sealed record GoogleTokenResponse
{
    public string AccessToken { get; init; } = string.Empty;
    public string IdToken { get; init; } = string.Empty;
    public string RefreshToken { get; init; } = string.Empty;
    public int ExpiresIn { get; init; }
    public string TokenType { get; init; } = string.Empty;
    public string Scope { get; init; } = string.Empty;
}
