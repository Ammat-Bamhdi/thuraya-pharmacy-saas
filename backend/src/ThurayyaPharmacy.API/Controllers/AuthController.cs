using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.ComponentModel.DataAnnotations;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

/// <summary>
/// Authentication controller - handles all auth operations
/// Production-ready with rate limiting, validation, and security best practices
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _logger;

    // Constants
    private const int MaxLoginAttempts = 5;
    private const int LockoutMinutes = 15;
    private const int AccessTokenExpiryHours = 1;
    private const int RefreshTokenExpiryDays = 7;

    public AuthController(ApplicationDbContext db, IConfiguration config, ILogger<AuthController> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    // ==================== Registration ====================

    /// <summary>
    /// Register a new tenant with super admin user
    /// </summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register([FromBody] RegisterRequest request)
    {
        // Validate request
        var validationErrors = ValidateRegisterRequest(request);
        if (validationErrors.Any())
        {
            return BadRequest(new ApiResponse<AuthResponse>(false, null, string.Join(". ", validationErrors)));
        }

        // Normalize email
        var email = request.Email.Trim().ToLowerInvariant();

        // Check if email exists
        if (await _db.Users.AnyAsync(u => u.Email == email))
        {
            _logger.LogWarning("Registration attempt with existing email: {Email}", email);
            return BadRequest(new ApiResponse<AuthResponse>(false, null, "An account with this email already exists. Please sign in instead."));
        }

        try
        {
            // Create tenant
            var tenant = new Tenant
            {
                Name = request.TenantName.Trim(),
                Country = request.Country,
                Currency = request.Currency,
                Language = Language.En,
                CreatedAt = DateTime.UtcNow
            };
            _db.Tenants.Add(tenant);

            // Create user with hashed password
            var user = new User
            {
                Name = request.Name.Trim(),
                Email = email,
                PasswordHash = HashPassword(request.Password),
                Role = UserRole.SuperAdmin,
                Status = UserStatus.Active,
                TenantId = tenant.Id,
                EmailVerified = false,
                FailedLoginAttempts = 0,
                CreatedAt = DateTime.UtcNow
            };
            _db.Users.Add(user);

            await _db.SaveChangesAsync();

            _logger.LogInformation("New user registered: {Email}, TenantId: {TenantId}", email, tenant.Id);

            // Generate tokens
            var (accessToken, expiresAt) = GenerateAccessToken(user, tenant.Id);
            var refreshToken = GenerateRefreshToken();

            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);
            await _db.SaveChangesAsync();

            var userDto = MapToUserDto(user, null);
            var response = new AuthResponse(accessToken, refreshToken, expiresAt, userDto);

            return Ok(new ApiResponse<AuthResponse>(true, response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during registration for email: {Email}", email);
            return StatusCode(500, new ApiResponse<AuthResponse>(false, null, "An error occurred during registration. Please try again."));
        }
    }

    // ==================== Login ====================

    /// <summary>
    /// Login with email and password
    /// </summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login([FromBody] LoginRequest request)
    {
        // Validate request
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new ApiResponse<AuthResponse>(false, null, "Email and password are required"));
        }

        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.Users
            .Include(u => u.Branch)
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Email == email);

        // User not found - don't reveal this for security
        if (user == null)
        {
            _logger.LogWarning("Login attempt for non-existent email: {Email}", email);
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, "Invalid email or password"));
        }

        // Check if account is locked
        if (user.LockoutEndTime.HasValue && user.LockoutEndTime > DateTime.UtcNow)
        {
            var remainingMinutes = (int)Math.Ceiling((user.LockoutEndTime.Value - DateTime.UtcNow).TotalMinutes);
            _logger.LogWarning("Login attempt on locked account: {Email}", email);
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, 
                $"Account is temporarily locked. Please try again in {remainingMinutes} minute(s)."));
        }

        // Verify password
        if (!VerifyPassword(request.Password, user.PasswordHash))
        {
            user.FailedLoginAttempts = (user.FailedLoginAttempts ?? 0) + 1;
            
            if (user.FailedLoginAttempts >= MaxLoginAttempts)
            {
                user.LockoutEndTime = DateTime.UtcNow.AddMinutes(LockoutMinutes);
                user.FailedLoginAttempts = 0;
                await _db.SaveChangesAsync();
                
                _logger.LogWarning("Account locked after failed attempts: {Email}", email);
                return Unauthorized(new ApiResponse<AuthResponse>(false, null, 
                    $"Account locked due to too many failed attempts. Please try again in {LockoutMinutes} minutes."));
            }

            await _db.SaveChangesAsync();
            var remainingAttempts = MaxLoginAttempts - user.FailedLoginAttempts;
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, 
                $"Invalid email or password. {remainingAttempts} attempt(s) remaining."));
        }

        // Check account status
        if (user.Status != UserStatus.Active)
        {
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, GetStatusMessage(user.Status)));
        }

        // Clear failed attempts on successful login
        user.FailedLoginAttempts = 0;
        user.LockoutEndTime = null;
        user.LastLoginAt = DateTime.UtcNow;

        // Generate tokens
        var (accessToken, expiresAt) = GenerateAccessToken(user, user.TenantId);
        var refreshToken = GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);
        await _db.SaveChangesAsync();

        _logger.LogInformation("User logged in: {Email}", email);

        var userDto = MapToUserDto(user, user.Branch);
        var response = new AuthResponse(accessToken, refreshToken, expiresAt, userDto);

        return Ok(new ApiResponse<AuthResponse>(true, response));
    }

    // ==================== Check Email Existence ====================

    /// <summary>
    /// Check if email exists - used for smart login/signup toggle
    /// </summary>
    [HttpPost("check-email")]
    [ProducesResponseType(typeof(ApiResponse<CheckEmailResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<CheckEmailResponse>>> CheckEmail([FromBody] CheckEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new ApiResponse<CheckEmailResponse>(false, null, "Email is required"));
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var exists = await _db.Users.AnyAsync(u => u.Email == email);

        return Ok(new ApiResponse<CheckEmailResponse>(true, new CheckEmailResponse(exists)));
    }

    // ==================== Google OAuth ====================

    /// <summary>
    /// Authenticate with Google OAuth (ID token from One Tap)
    /// </summary>
    [HttpPost("google")]
    [ProducesResponseType(typeof(ApiResponse<GoogleAuthResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> GoogleAuth([FromBody] GoogleAuthRequest request)
    {
        try
        {
            var payload = await VerifyGoogleToken(request.Credential);
            if (payload == null)
            {
                return Unauthorized(new ApiResponse<GoogleAuthResponse>(false, null, "Invalid Google token"));
            }

            return await ProcessGoogleAuth(payload, request.TenantName, request.Country, request.Currency);
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning(ex, "Invalid Google JWT token");
            return Unauthorized(new ApiResponse<GoogleAuthResponse>(false, null, "Invalid Google token"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during Google authentication");
            return StatusCode(500, new ApiResponse<GoogleAuthResponse>(false, null, "Authentication failed. Please try again."));
        }
    }

    /// <summary>
    /// Authenticate with Google authorization code (popup flow)
    /// </summary>
    [HttpPost("google/code")]
    [ProducesResponseType(typeof(ApiResponse<GoogleAuthResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> GoogleAuthWithCode([FromBody] GoogleCodeRequest request)
    {
        try
        {
            var tokenResponse = await ExchangeCodeForTokens(request.Code);
            if (tokenResponse == null)
            {
                return BadRequest(new ApiResponse<GoogleAuthResponse>(false, null, "Failed to exchange code for tokens"));
            }

            var payload = await VerifyGoogleToken(tokenResponse.IdToken);
            if (payload == null)
            {
                return Unauthorized(new ApiResponse<GoogleAuthResponse>(false, null, "Invalid Google token"));
            }

            return await ProcessGoogleAuth(payload);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during Google code authentication");
            return StatusCode(500, new ApiResponse<GoogleAuthResponse>(false, null, "Authentication failed. Please try again."));
        }
    }

    /// <summary>
    /// Process Google authentication for both flows
    /// </summary>
    private async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> ProcessGoogleAuth(
        GoogleJsonWebSignature.Payload payload, 
        string? tenantName = null, 
        string? country = null, 
        string? currency = null)
    {
        var email = payload.Email.ToLowerInvariant();
        
        _logger.LogInformation("Google auth for email: {Email}", email);

        var existingUser = await _db.Users
            .Include(u => u.Branch)
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Email == email);

        if (existingUser != null)
        {
            return await HandleExistingGoogleUser(existingUser, payload);
        }
        else
        {
            return await HandleNewGoogleUser(payload, tenantName, country, currency);
        }
    }

    private async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> HandleExistingGoogleUser(
        User user, GoogleJsonWebSignature.Payload payload)
    {
        if (user.Status != UserStatus.Active)
        {
            return Unauthorized(new ApiResponse<GoogleAuthResponse>(false, null, GetStatusMessage(user.Status)));
        }

        var (accessToken, expiresAt) = GenerateAccessToken(user, user.TenantId);
        var refreshToken = GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);
        user.LastLoginAt = DateTime.UtcNow;

        // Update Google-specific fields
        if (!string.IsNullOrEmpty(payload.Picture) && user.Avatar != payload.Picture)
        {
            user.Avatar = payload.Picture;
        }
        if (string.IsNullOrEmpty(user.GoogleId))
        {
            user.GoogleId = payload.Subject;
        }
        user.EmailVerified = payload.EmailVerified;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Google user logged in: {Email}", user.Email);

        // Get tenant for response
        var tenant = await _db.Tenants.FindAsync(user.TenantId);
        TenantDto? tenantDto = tenant != null ? new TenantDto(
            tenant.Id, tenant.Name, tenant.Country, tenant.Currency, tenant.Language.ToString()
        ) : null;

        var userDto = MapToUserDto(user, user.Branch);
        return Ok(new ApiResponse<GoogleAuthResponse>(true, new GoogleAuthResponse(
            accessToken, refreshToken, expiresAt, userDto, IsNewUser: false, Tenant: tenantDto
        )));
    }

    private async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> HandleNewGoogleUser(
        GoogleJsonWebSignature.Payload payload, 
        string? tenantName = null, 
        string? country = null, 
        string? currency = null)
    {
        var email = payload.Email.ToLowerInvariant();
        var name = payload.Name ?? email.Split('@')[0];

        var tenant = new Tenant
        {
            Name = tenantName ?? $"{name}'s Organization",
            Country = country ?? "SA",
            Currency = currency ?? "SAR",
            Language = Language.En,
            CreatedAt = DateTime.UtcNow
        };
        _db.Tenants.Add(tenant);

        var newUser = new User
        {
            Name = name,
            Email = email,
            PasswordHash = "", // No password for Google users
            GoogleId = payload.Subject,
            Avatar = payload.Picture,
            Role = UserRole.SuperAdmin,
            Status = UserStatus.Active,
            TenantId = tenant.Id,
            EmailVerified = payload.EmailVerified,
            FailedLoginAttempts = 0,
            CreatedAt = DateTime.UtcNow
        };
        _db.Users.Add(newUser);
        await _db.SaveChangesAsync();

        var (accessToken, expiresAt) = GenerateAccessToken(newUser, tenant.Id);
        var refreshToken = GenerateRefreshToken();

        newUser.RefreshToken = refreshToken;
        newUser.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);
        newUser.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("New Google user registered: {Email}, TenantId: {TenantId}", email, tenant.Id);

        // Include tenant in response for immediate UI update
        var tenantDto = new TenantDto(
            tenant.Id, tenant.Name, tenant.Country, tenant.Currency, tenant.Language.ToString()
        );

        var userDto = MapToUserDto(newUser, null);
        return Ok(new ApiResponse<GoogleAuthResponse>(true, new GoogleAuthResponse(
            accessToken, refreshToken, expiresAt, userDto, IsNewUser: true, Tenant: tenantDto
        )));
    }

    // ==================== Token Refresh ====================

    /// <summary>
    /// Refresh access token using refresh token
    /// </summary>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(new ApiResponse<AuthResponse>(false, null, "Refresh token is required"));
        }

        var user = await _db.Users
            .Include(u => u.Branch)
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);

        if (user == null)
        {
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, "Invalid refresh token"));
        }

        if (user.RefreshTokenExpiryTime < DateTime.UtcNow)
        {
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, "Refresh token has expired. Please sign in again."));
        }

        if (user.Status != UserStatus.Active)
        {
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, GetStatusMessage(user.Status)));
        }

        var (accessToken, expiresAt) = GenerateAccessToken(user, user.TenantId);
        var refreshToken = GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);
        await _db.SaveChangesAsync();

        var userDto = MapToUserDto(user, user.Branch);
        var response = new AuthResponse(accessToken, refreshToken, expiresAt, userDto);

        return Ok(new ApiResponse<AuthResponse>(true, response));
    }

    // ==================== Get Current User ====================

    /// <summary>
    /// Get current authenticated user - validates user exists in database
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<MeResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<MeResponse>>> GetCurrentUser()
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new ApiResponse<MeResponse>(false, null, "Invalid token"));
            }

            var user = await _db.Users
                .Include(u => u.Branch)
                .Include(u => u.Tenant)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return Unauthorized(new ApiResponse<MeResponse>(false, null, "User not found"));
            }

            if (user.Status != UserStatus.Active)
            {
                return Unauthorized(new ApiResponse<MeResponse>(false, null, GetStatusMessage(user.Status)));
            }

            var userDto = MapToUserDto(user, user.Branch);
            TenantDto? tenantDto = null;
            if (user.Tenant != null)
            {
                _logger.LogInformation("Tenant found for user {UserId}: {TenantName} ({TenantId})", 
                    user.Id, user.Tenant.Name, user.Tenant.Id);
                tenantDto = new TenantDto(
                    user.Tenant.Id,
                    user.Tenant.Name,
                    user.Tenant.Country,
                    user.Tenant.Currency,
                    user.Tenant.Language.ToString()
                );
            }
            else
            {
                _logger.LogWarning("No tenant found for user {UserId}", user.Id);
            }
            
            _logger.LogInformation("Returning MeResponse with tenant: {TenantName}", tenantDto?.Name ?? "null");
            return Ok(new ApiResponse<MeResponse>(true, new MeResponse(userDto, tenantDto)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current user");
            return Unauthorized(new ApiResponse<MeResponse>(false, null, "Authentication failed"));
        }
    }

    // ==================== Logout ====================

    /// <summary>
    /// Logout - invalidate refresh token
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> Logout()
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!string.IsNullOrEmpty(userIdClaim) && Guid.TryParse(userIdClaim, out var userId))
            {
                var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (user != null)
                {
                    user.RefreshToken = null;
                    user.RefreshTokenExpiryTime = null;
                    await _db.SaveChangesAsync();
                    _logger.LogInformation("User logged out: {UserId}", userId);
                }
            }

            return Ok(new ApiResponse<bool>(true, true));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during logout");
            return Ok(new ApiResponse<bool>(true, true)); // Always succeed
        }
    }

    // ==================== Helper Methods ====================

    private List<string> ValidateRegisterRequest(RegisterRequest request)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(request.Name))
            errors.Add("Name is required");
        else if (request.Name.Trim().Length < 2)
            errors.Add("Name must be at least 2 characters");

        if (string.IsNullOrWhiteSpace(request.Email))
            errors.Add("Email is required");
        else if (!IsValidEmail(request.Email))
            errors.Add("Invalid email format");

        if (string.IsNullOrWhiteSpace(request.Password))
            errors.Add("Password is required");
        else
        {
            var pwdErrors = ValidatePassword(request.Password);
            errors.AddRange(pwdErrors);
        }

        if (string.IsNullOrWhiteSpace(request.TenantName))
            errors.Add("Organization name is required");

        if (string.IsNullOrWhiteSpace(request.Country))
            errors.Add("Country is required");

        if (string.IsNullOrWhiteSpace(request.Currency))
            errors.Add("Currency is required");

        return errors;
    }

    private List<string> ValidatePassword(string password)
    {
        var errors = new List<string>();

        if (password.Length < 8)
            errors.Add("Password must be at least 8 characters");
        if (!password.Any(char.IsUpper))
            errors.Add("Password must contain at least one uppercase letter");
        if (!password.Any(char.IsLower))
            errors.Add("Password must contain at least one lowercase letter");
        if (!password.Any(char.IsDigit))
            errors.Add("Password must contain at least one number");

        return errors;
    }

    private bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email.Trim();
        }
        catch
        {
            return false;
        }
    }

    private string GetStatusMessage(UserStatus status)
    {
        return status switch
        {
            UserStatus.Invited => "Your account is pending activation. Please check your email.",
            UserStatus.Suspended => "Your account has been suspended. Please contact support.",
            _ => "Account is not active"
        };
    }

    private UserDto MapToUserDto(User user, Branch? branch)
    {
        return new UserDto(
            user.Id,
            user.Name,
            user.Email,
            user.Role,
            user.BranchId,
            branch?.Name,
            user.Status,
            user.Avatar
        );
    }

    private async Task<GoogleJsonWebSignature.Payload?> VerifyGoogleToken(string idToken)
    {
        try
        {
            var clientId = _config["Google:ClientId"];
            if (string.IsNullOrEmpty(clientId))
            {
                _logger.LogError("Google Client ID not configured");
                return null;
            }

            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { clientId }
            };

            return await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
        }
        catch (InvalidJwtException)
        {
            return null;
        }
    }

    private async Task<GoogleTokenResponse?> ExchangeCodeForTokens(string code)
    {
        var clientId = _config["Google:ClientId"];
        var clientSecret = _config["Google:ClientSecret"];

        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
        {
            _logger.LogError("Google OAuth credentials not configured");
            return null;
        }

        using var httpClient = new HttpClient();
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            { "code", code },
            { "client_id", clientId },
            { "client_secret", clientSecret },
            { "redirect_uri", "postmessage" },
            { "grant_type", "authorization_code" }
        });

        var response = await httpClient.PostAsync("https://oauth2.googleapis.com/token", content);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError("Google token exchange failed: {Error}", error);
            return null;
        }

        var json = await response.Content.ReadAsStringAsync();
        return System.Text.Json.JsonSerializer.Deserialize<GoogleTokenResponse>(json, new System.Text.Json.JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
    }

    private (string token, DateTime expiresAt) GenerateAccessToken(User user, Guid tenantId)
    {
        var key = _config["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured");
        var issuer = _config["Jwt:Issuer"] ?? "ThurayyaPharmacy";
        var audience = _config["Jwt:Audience"] ?? "ThurayyaPharmacyApp";

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddHours(AccessTokenExpiryHours);

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
        return BCrypt.Net.BCrypt.HashPassword(password, 12);
    }

    private static bool VerifyPassword(string password, string hash)
    {
        if (string.IsNullOrEmpty(hash)) return false;
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }
}

// ==================== Request/Response DTOs ====================

public record CheckEmailRequest(string Email);
public record CheckEmailResponse(bool Exists);
