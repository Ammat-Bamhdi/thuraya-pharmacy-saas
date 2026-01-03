using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _logger;

    // Google Client ID for token verification
    private const string GoogleClientId = "826988304508-nb0662tfl3uo5b0b87tmvkvmsbtn6g44.apps.googleusercontent.com";

    public AuthController(ApplicationDbContext db, IConfiguration config, ILogger<AuthController> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register([FromBody] RegisterRequest request)
    {
        // Check if email exists
        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
        {
            return BadRequest(new ApiResponse<AuthResponse>(false, null, "Email already exists"));
        }

        // Create tenant
        var tenant = new Tenant
        {
            Name = request.TenantName,
            Country = request.Country,
            Currency = request.Currency,
            Language = Language.En
        };
        _db.Tenants.Add(tenant);

        // Create user
        var user = new User
        {
            Name = request.Name,
            Email = request.Email,
            PasswordHash = HashPassword(request.Password),
            Role = UserRole.SuperAdmin,
            Status = UserStatus.Active,
            TenantId = tenant.Id
        };
        _db.Users.Add(user);
        
        await _db.SaveChangesAsync();

        // Generate tokens
        var (accessToken, expiresAt) = GenerateAccessToken(user, tenant.Id);
        var refreshToken = GenerateRefreshToken();
        
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _db.SaveChangesAsync();

        var userDto = new UserDto(user.Id, user.Name, user.Email, user.Role, user.BranchId, null, user.Status, user.Avatar);
        var response = new AuthResponse(accessToken, refreshToken, expiresAt, userDto);
        
        return Ok(new ApiResponse<AuthResponse>(true, response));
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login([FromBody] LoginRequest request)
    {
        var user = await _db.Users
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Email == request.Email);

        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, "Invalid email or password"));
        }

        if (user.Status != UserStatus.Active)
        {
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, "Account is not active"));
        }

        // Generate tokens
        var (accessToken, expiresAt) = GenerateAccessToken(user, user.TenantId);
        var refreshToken = GenerateRefreshToken();
        
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _db.SaveChangesAsync();

        var userDto = new UserDto(user.Id, user.Name, user.Email, user.Role, user.BranchId, user.Branch?.Name, user.Status, user.Avatar);
        var response = new AuthResponse(accessToken, refreshToken, expiresAt, userDto);
        
        return Ok(new ApiResponse<AuthResponse>(true, response));
    }

    /// <summary>
    /// Authenticate with Google OAuth
    /// </summary>
    [HttpPost("google")]
    public async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> GoogleAuth([FromBody] GoogleAuthRequest request)
    {
        try
        {
            // Verify the Google ID token
            var payload = await VerifyGoogleToken(request.Credential);
            if (payload == null)
            {
                return Unauthorized(new ApiResponse<GoogleAuthResponse>(false, null, "Invalid Google token"));
            }

            _logger.LogInformation("Google auth for email: {Email}", payload.Email);

            // Check if user exists
            var existingUser = await _db.Users
                .Include(u => u.Branch)
                .Include(u => u.Tenant)
                .FirstOrDefaultAsync(u => u.Email == payload.Email);

            if (existingUser != null)
            {
                // Existing user - login
                if (existingUser.Status != UserStatus.Active)
                {
                    return Unauthorized(new ApiResponse<GoogleAuthResponse>(false, null, "Account is not active"));
                }

                var (accessToken, expiresAt) = GenerateAccessToken(existingUser, existingUser.TenantId);
                var refreshToken = GenerateRefreshToken();

                existingUser.RefreshToken = refreshToken;
                existingUser.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
                
                // Update avatar if changed
                if (!string.IsNullOrEmpty(payload.Picture) && existingUser.Avatar != payload.Picture)
                {
                    existingUser.Avatar = payload.Picture;
                }
                
                await _db.SaveChangesAsync();

                var userDto = new UserDto(
                    existingUser.Id, 
                    existingUser.Name, 
                    existingUser.Email, 
                    existingUser.Role, 
                    existingUser.BranchId, 
                    existingUser.Branch?.Name, 
                    existingUser.Status, 
                    existingUser.Avatar
                );

                return Ok(new ApiResponse<GoogleAuthResponse>(true, new GoogleAuthResponse(
                    accessToken, refreshToken, expiresAt, userDto, IsNewUser: false
                )));
            }
            else
            {
                // New user - register with Google
                // Create a placeholder tenant (will be completed in onboarding)
                var tenant = new Tenant
                {
                    Name = request.TenantName ?? $"{payload.Name ?? "My"}'s Organization",
                    Country = request.Country ?? "SA",
                    Currency = request.Currency ?? "SAR",
                    Language = Language.En
                };
                _db.Tenants.Add(tenant);

                // Create user (no password - Google-only auth)
                var newUser = new User
                {
                    Name = payload.Name ?? payload.Email.Split('@')[0],
                    Email = payload.Email,
                    PasswordHash = "", // No password for Google users
                    GoogleId = payload.Subject, // Store Google user ID
                    Avatar = payload.Picture,
                    Role = UserRole.SuperAdmin,
                    Status = UserStatus.Active,
                    TenantId = tenant.Id,
                    EmailVerified = payload.EmailVerified
                };
                _db.Users.Add(newUser);

                await _db.SaveChangesAsync();

                var (accessToken, expiresAt) = GenerateAccessToken(newUser, tenant.Id);
                var refreshToken = GenerateRefreshToken();

                newUser.RefreshToken = refreshToken;
                newUser.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
                await _db.SaveChangesAsync();

                var userDto = new UserDto(
                    newUser.Id, 
                    newUser.Name, 
                    newUser.Email, 
                    newUser.Role, 
                    newUser.BranchId, 
                    null, 
                    newUser.Status, 
                    newUser.Avatar
                );

                return Ok(new ApiResponse<GoogleAuthResponse>(true, new GoogleAuthResponse(
                    accessToken, refreshToken, expiresAt, userDto, IsNewUser: true
                )));
            }
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning(ex, "Invalid Google JWT token");
            return Unauthorized(new ApiResponse<GoogleAuthResponse>(false, null, "Invalid Google token"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during Google authentication");
            return StatusCode(500, new ApiResponse<GoogleAuthResponse>(false, null, "Authentication failed"));
        }
    }

    /// <summary>
    /// Verify Google ID token
    /// </summary>
    private async Task<GoogleJsonWebSignature.Payload?> VerifyGoogleToken(string idToken)
    {
        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { GoogleClientId }
            };

            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
            return payload;
        }
        catch (InvalidJwtException)
        {
            return null;
        }
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var user = await _db.Users
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);

        if (user == null || user.RefreshTokenExpiryTime < DateTime.UtcNow)
        {
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, "Invalid or expired refresh token"));
        }

        var (accessToken, expiresAt) = GenerateAccessToken(user, user.TenantId);
        var refreshToken = GenerateRefreshToken();
        
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _db.SaveChangesAsync();

        var userDto = new UserDto(user.Id, user.Name, user.Email, user.Role, user.BranchId, user.Branch?.Name, user.Status, user.Avatar);
        var response = new AuthResponse(accessToken, refreshToken, expiresAt, userDto);
        
        return Ok(new ApiResponse<AuthResponse>(true, response));
    }

    private (string token, DateTime expiresAt) GenerateAccessToken(User user, Guid tenantId)
    {
        var key = _config["Jwt:Key"] ?? "ThurayyaPharmacySecretKey2026SuperSecure!@#$%";
        var issuer = _config["Jwt:Issuer"] ?? "ThurayyaPharmacy";
        var audience = _config["Jwt:Audience"] ?? "ThurayyaPharmacyApp";
        
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddHours(1);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("tenantId", tenantId.ToString()),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("branchId", user.BranchId?.ToString() ?? ""),
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

    private static string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    private static string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    private static bool VerifyPassword(string password, string hash)
    {
        // For Google users, password is empty
        if (string.IsNullOrEmpty(hash)) return false;
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }
}
