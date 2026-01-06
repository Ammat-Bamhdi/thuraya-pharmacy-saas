using System.Text.Json;
using Google.Apis.Auth;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ThurayyaPharmacy.Application.Interfaces;

namespace ThurayyaPharmacy.Infrastructure.Services;

/// <summary>
/// Implementation of IGoogleAuthService for Google OAuth operations.
/// </summary>
public sealed class GoogleAuthService : IGoogleAuthService
{
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GoogleAuthService> _logger;

    private const string GoogleClientIdCacheKey = "google:clientId";
    private const string HttpClientName = "google";

    public GoogleAuthService(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        ILogger<GoogleAuthService> logger)
    {
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<GoogleUserInfo?> VerifyTokenAsync(string idToken)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            _logger.LogWarning("Google token verification failed: idToken is null or empty");
            return null;
        }

        try
        {
            var clientId = GetCachedClientId();
            if (string.IsNullOrEmpty(clientId))
            {
                _logger.LogError("Google Client ID not configured");
                return null;
            }

            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { clientId }
            };

            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
            
            return new GoogleUserInfo
            {
                Subject = payload.Subject,
                Email = payload.Email,
                EmailVerified = payload.EmailVerified,
                Name = payload.Name,
                Picture = payload.Picture
            };
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning(ex, "Invalid Google JWT token: {Message}", ex.Message);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying Google token: {Message}", ex.Message);
            return null;
        }
    }

    /// <inheritdoc />
    public async Task<GoogleTokenResponse?> ExchangeCodeForTokensAsync(
        string code,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var clientId = _configuration["Google:ClientId"];
        var clientSecret = _configuration["Google:ClientSecret"];

        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
        {
            _logger.LogError("Google OAuth credentials not configured");
            return null;
        }

        try
        {
            var httpClient = _httpClientFactory.CreateClient(HttpClientName);
            
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "code", code },
                { "client_id", clientId },
                { "client_secret", clientSecret },
                { "redirect_uri", "postmessage" },
                { "grant_type", "authorization_code" }
            });

            var response = await httpClient.PostAsync("token", content, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Google token exchange failed. Status: {StatusCode}, Error: {Error}", 
                    response.StatusCode, error);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            
            // Manual JSON parsing (System.Text.Json deserialization was failing)
            using var jsonDoc = JsonDocument.Parse(json);
            var root = jsonDoc.RootElement;
            
            var tokenResponse = new GoogleTokenResponse
            {
                AccessToken = root.TryGetProperty("access_token", out var accessToken) ? accessToken.GetString() : null,
                IdToken = root.TryGetProperty("id_token", out var idToken) ? idToken.GetString() : null,
                RefreshToken = root.TryGetProperty("refresh_token", out var refreshToken) ? refreshToken.GetString() : null,
                ExpiresIn = root.TryGetProperty("expires_in", out var expiresIn) ? expiresIn.GetInt32() : 0
            };
            
            if (tokenResponse.IdToken == null)
            {
                _logger.LogWarning("Token exchange succeeded but id_token is missing");
                return null;
            }
            
            return tokenResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exchanging code for tokens");
            return null;
        }
    }

    private string? GetCachedClientId()
    {
        return _cache.GetOrCreate(GoogleClientIdCacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
            return _configuration["Google:ClientId"];
        });
    }
}
