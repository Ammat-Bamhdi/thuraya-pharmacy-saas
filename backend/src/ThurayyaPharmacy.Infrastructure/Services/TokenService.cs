using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Domain.Entities;

namespace ThurayyaPharmacy.Infrastructure.Services;

/// <summary>
/// Implementation of ITokenService for JWT token generation.
/// </summary>
public sealed class TokenService : ITokenService
{
    private readonly IConfiguration _configuration;
    
    private const int AccessTokenExpiryHours = 1;
    private const int RefreshTokenByteLength = 64;

    public TokenService(IConfiguration configuration)
    {
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
    }

    /// <inheritdoc />
    public (string Token, DateTime ExpiresAt) GenerateAccessToken(User user, Guid tenantId)
    {
        ArgumentNullException.ThrowIfNull(user);

        var key = _configuration["Jwt:Key"] 
            ?? throw new InvalidOperationException("JWT Key not configured");
        var issuer = _configuration["Jwt:Issuer"] ?? "ThurayyaPharmacy";
        var audience = _configuration["Jwt:Audience"] ?? "ThurayyaPharmacyApp";

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddHours(AccessTokenExpiryHours);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("tenantId", tenantId.ToString()),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("branchId", user.BranchId?.ToString() ?? string.Empty),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials
        );

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    /// <inheritdoc />
    public string GenerateRefreshToken()
    {
        var randomBytes = new byte[RefreshTokenByteLength];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }
}
