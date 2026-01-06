using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Application.Mappings;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

/// <summary>
/// Authentication controller - handles all auth operations.
/// Refactored to use dependency injection for services.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly IPasswordService _passwordService;
    private readonly IValidationService _validationService;
    private readonly IGoogleAuthService _googleAuthService;
    private readonly ILogger<AuthController> _logger;

    // Security Constants
    private const int MaxLoginAttempts = 5;
    private const int LockoutMinutes = 15;
    private const int RefreshTokenExpiryDays = 7;

    public AuthController(
        ApplicationDbContext db,
        ITokenService tokenService,
        IPasswordService passwordService,
        IValidationService validationService,
        IGoogleAuthService googleAuthService,
        ILogger<AuthController> logger)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
        _tokenService = tokenService ?? throw new ArgumentNullException(nameof(tokenService));
        _passwordService = passwordService ?? throw new ArgumentNullException(nameof(passwordService));
        _validationService = validationService ?? throw new ArgumentNullException(nameof(validationService));
        _googleAuthService = googleAuthService ?? throw new ArgumentNullException(nameof(googleAuthService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    #region Registration

    /// <summary>
    /// Register a new tenant with super admin user.
    /// </summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken ct)
    {
        var validationErrors = _validationService.ValidateRegisterRequest(request);
        if (validationErrors.Count > 0)
        {
            return BadRequest(ApiResponse<AuthResponse>.Fail(string.Join(". ", validationErrors)));
        }

        var email = _validationService.NormalizeEmail(request.Email);

        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
        {
            _logger.LogWarning("Registration attempt with existing email: {Email}", email);
            return BadRequest(ApiResponse<AuthResponse>.Fail(
                "An account with this email already exists. Please sign in instead."));
        }

        try
        {
            var (tenant, user) = CreateTenantAndUser(request, email);

            _db.Tenants.Add(tenant);
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("New user registered: {Email}, TenantId: {TenantId}", email, tenant.Id);

            var authResponse = await GenerateAuthResponseAsync(user, tenant.Id, ct);
            return Ok(ApiResponse<AuthResponse>.Ok(authResponse));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during registration for email: {Email}", email);
            return StatusCode(500, ApiResponse<AuthResponse>.Fail(
                "An error occurred during registration. Please try again."));
        }
    }

    #endregion

    #region Login

    /// <summary>
    /// Login with email and password.
    /// </summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login(
        [FromBody] LoginRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(ApiResponse<AuthResponse>.Fail("Email and password are required"));
        }

        var email = _validationService.NormalizeEmail(request.Email);

        var user = await _db.Users
            .Include(u => u.Branch)
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Email == email, ct);

        if (user == null)
        {
            _logger.LogWarning("Login attempt for non-existent email: {Email}", email);
            return Unauthorized(ApiResponse<AuthResponse>.Fail("Invalid email or password"));
        }

        // Check account lockout
        var lockoutResult = CheckAccountLockout(user);
        if (lockoutResult != null) return lockoutResult;

        // Verify password
        if (!_passwordService.VerifyPassword(request.Password, user.PasswordHash))
        {
            return await HandleFailedLoginAsync(user, ct);
        }

        // Check account status
        if (user.Status != UserStatus.Active)
        {
            return Unauthorized(ApiResponse<AuthResponse>.Fail(user.Status.GetStatusMessage()));
        }

        // Successful login
        await ResetLoginAttemptsAsync(user, ct);

        _logger.LogInformation("User logged in: {Email}", email);

        var authResponse = await GenerateAuthResponseAsync(user, user.TenantId, ct, user.Branch);
        return Ok(ApiResponse<AuthResponse>.Ok(authResponse));
    }

    #endregion

    #region Check Email

    /// <summary>
    /// Check if email exists - used for smart login/signup toggle.
    /// </summary>
    [HttpPost("check-email")]
    [DisableRateLimiting]
    [ProducesResponseType(typeof(ApiResponse<CheckEmailResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<CheckEmailResponse>>> CheckEmail(
        [FromBody] CheckEmailRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(ApiResponse<CheckEmailResponse>.Fail("Email is required"));
        }

        var email = _validationService.NormalizeEmail(request.Email);
        var exists = await _db.Users.AnyAsync(u => u.Email == email, ct);

        return Ok(ApiResponse<CheckEmailResponse>.Ok(new CheckEmailResponse(exists)));
    }

    #endregion

    #region Google OAuth

    /// <summary>
    /// Authenticate with Google OAuth (ID token from One Tap).
    /// </summary>
    [HttpPost("google")]
    [ProducesResponseType(typeof(ApiResponse<GoogleAuthResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> GoogleAuth(
        [FromBody] GoogleAuthRequest request,
        CancellationToken ct)
    {
        try
        {
            var payload = await _googleAuthService.VerifyTokenAsync(request.Credential);
            if (payload == null)
            {
                return Unauthorized(ApiResponse<GoogleAuthResponse>.Fail("Invalid Google token"));
            }

            return await ProcessGoogleAuthAsync(payload, request.TenantName, request.Country, request.Currency, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during Google authentication");
            return StatusCode(500, ApiResponse<GoogleAuthResponse>.Fail("Authentication failed. Please try again."));
        }
    }

    /// <summary>
    /// Authenticate with Google authorization code (popup flow).
    /// </summary>
    [HttpPost("google/code")]
    [ProducesResponseType(typeof(ApiResponse<GoogleAuthResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> GoogleAuthWithCode(
        [FromBody] GoogleCodeRequest request,
        CancellationToken ct)
    {
        try
        {
            var tokenResponse = await _googleAuthService.ExchangeCodeForTokensAsync(request.Code, ct);
            if (tokenResponse == null)
            {
                return BadRequest(ApiResponse<GoogleAuthResponse>.Fail("Failed to exchange code for tokens"));
            }
            
            var payload = await _googleAuthService.VerifyTokenAsync(tokenResponse.IdToken);
            if (payload == null)
            {
                return Unauthorized(ApiResponse<GoogleAuthResponse>.Fail("Invalid Google token"));
            }
            
            return await ProcessGoogleAuthAsync(payload, ct: ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during Google code authentication");
            return StatusCode(500, ApiResponse<GoogleAuthResponse>.Fail("Authentication failed. Please try again."));
        }
    }

    #endregion

    #region Token Refresh

    /// <summary>
    /// Refresh access token using refresh token.
    /// </summary>
    [HttpPost("refresh")]
    [DisableRateLimiting]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> RefreshToken(
        [FromBody] RefreshTokenRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(ApiResponse<AuthResponse>.Fail("Refresh token is required"));
        }

        var user = await _db.Users
            .Include(u => u.Branch)
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken, ct);

        if (user == null)
        {
            return Unauthorized(ApiResponse<AuthResponse>.Fail("Invalid refresh token"));
        }

        if (user.RefreshTokenExpiryTime < DateTime.UtcNow)
        {
            return Unauthorized(ApiResponse<AuthResponse>.Fail("Refresh token has expired. Please sign in again."));
        }

        if (user.Status != UserStatus.Active)
        {
            return Unauthorized(ApiResponse<AuthResponse>.Fail(user.Status.GetStatusMessage()));
        }

        var authResponse = await GenerateAuthResponseAsync(user, user.TenantId, ct, user.Branch);
        return Ok(ApiResponse<AuthResponse>.Ok(authResponse));
    }

    #endregion

    #region Current User

    /// <summary>
    /// Get current authenticated user - validates user exists in database.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [DisableRateLimiting]
    [ProducesResponseType(typeof(ApiResponse<MeResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<MeResponse>>> GetCurrentUser(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(ApiResponse<MeResponse>.Fail("Invalid token"));
        }

        var user = await _db.Users
            .AsNoTracking()
            .Include(u => u.Branch)
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        if (user == null)
        {
            return Unauthorized(ApiResponse<MeResponse>.Fail("User not found"));
        }

        if (user.Status != UserStatus.Active)
        {
            return Unauthorized(ApiResponse<MeResponse>.Fail(user.Status.GetStatusMessage()));
        }

        var userDto = user.ToDto(user.Branch);
        var tenantDto = user.Tenant?.ToDto();

        return Ok(ApiResponse<MeResponse>.Ok(new MeResponse(userDto, tenantDto)));
    }

    #endregion

    #region Logout

    /// <summary>
    /// Logout - invalidate refresh token.
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    [DisableRateLimiting]
    public async Task<ActionResult<ApiResponse<bool>>> Logout(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId != null)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user != null)
            {
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;
                await _db.SaveChangesAsync(ct);
                _logger.LogInformation("User logged out: {UserId}", userId);
            }
        }

        return Ok(ApiResponse<bool>.Ok(true));
    }

    #endregion

    #region Private Helper Methods

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;

        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private (Tenant tenant, User user) CreateTenantAndUser(RegisterRequest request, string email)
    {
        var tenant = new Tenant
        {
            Name = request.TenantName.Trim(),
            Country = request.Country,
            Currency = request.Currency,
            Language = Language.En,
            CreatedAt = DateTime.UtcNow
        };

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = _passwordService.HashPassword(request.Password),
            Role = UserRole.SuperAdmin,
            Status = UserStatus.Active,
            TenantId = tenant.Id,
            EmailVerified = false,
            FailedLoginAttempts = 0,
            CreatedAt = DateTime.UtcNow
        };

        return (tenant, user);
    }

    private ActionResult<ApiResponse<AuthResponse>>? CheckAccountLockout(User user)
    {
        if (user.LockoutEndTime.HasValue && user.LockoutEndTime > DateTime.UtcNow)
        {
            var remainingMinutes = (int)Math.Ceiling((user.LockoutEndTime.Value - DateTime.UtcNow).TotalMinutes);
            _logger.LogWarning("Login attempt on locked account: {Email}", user.Email);
            return Unauthorized(ApiResponse<AuthResponse>.Fail(
                $"Account is temporarily locked. Please try again in {remainingMinutes} minute(s)."));
        }
        return null;
    }

    private async Task<ActionResult<ApiResponse<AuthResponse>>> HandleFailedLoginAsync(User user, CancellationToken ct)
    {
        user.FailedLoginAttempts = (user.FailedLoginAttempts ?? 0) + 1;

        if (user.FailedLoginAttempts >= MaxLoginAttempts)
        {
            user.LockoutEndTime = DateTime.UtcNow.AddMinutes(LockoutMinutes);
            user.FailedLoginAttempts = 0;
            await _db.SaveChangesAsync(ct);

            _logger.LogWarning("Account locked after failed attempts: {Email}", user.Email);
            return Unauthorized(ApiResponse<AuthResponse>.Fail(
                $"Account locked due to too many failed attempts. Please try again in {LockoutMinutes} minutes."));
        }

        await _db.SaveChangesAsync(ct);
        var remainingAttempts = MaxLoginAttempts - user.FailedLoginAttempts;
        return Unauthorized(ApiResponse<AuthResponse>.Fail(
            $"Invalid email or password. {remainingAttempts} attempt(s) remaining."));
    }

    private async Task ResetLoginAttemptsAsync(User user, CancellationToken ct)
    {
        user.FailedLoginAttempts = 0;
        user.LockoutEndTime = null;
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task<AuthResponse> GenerateAuthResponseAsync(
        User user,
        Guid tenantId,
        CancellationToken ct,
        Branch? branch = null)
    {
        var (accessToken, expiresAt) = _tokenService.GenerateAccessToken(user, tenantId);
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);
        await _db.SaveChangesAsync(ct);

        var userDto = user.ToDto(branch);
        return new AuthResponse(accessToken, refreshToken, expiresAt, userDto);
    }

    private async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> ProcessGoogleAuthAsync(
        GoogleUserInfo userInfo,
        string? tenantName = null,
        string? country = null,
        string? currency = null,
        CancellationToken ct = default)
    {
        var email = _validationService.NormalizeEmail(userInfo.Email);

        var existingUser = await _db.Users
            .Include(u => u.Branch)
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Email == email, ct);

        if (existingUser != null)
        {
            return await HandleExistingGoogleUserAsync(existingUser, userInfo, ct);
        }
        
        return await HandleNewGoogleUserAsync(userInfo, tenantName, country, currency, ct);
    }

    private async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> HandleExistingGoogleUserAsync(
        User user,
        GoogleUserInfo userInfo,
        CancellationToken ct)
    {
        if (user.Status != UserStatus.Active)
        {
            return Unauthorized(ApiResponse<GoogleAuthResponse>.Fail(user.Status.GetStatusMessage()));
        }

        UpdateGoogleUserFields(user, userInfo);

        var authResponse = await GenerateGoogleAuthResponseAsync(user, user.TenantId, false, user.Tenant, ct, user.Branch);

        _logger.LogInformation("Google user logged in: {Email}", user.Email);
        return Ok(ApiResponse<GoogleAuthResponse>.Ok(authResponse));
    }

    private async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> HandleNewGoogleUserAsync(
        GoogleUserInfo userInfo,
        string? tenantName,
        string? country,
        string? currency,
        CancellationToken ct)
    {
        try
        {
            var email = _validationService.NormalizeEmail(userInfo.Email);
            var name = userInfo.Name ?? email.Split('@')[0];

            var tenant = new Tenant
            {
                Name = tenantName ?? $"{name}'s Organization",
                Country = country ?? "SA",
                Currency = currency ?? "SAR",
                Language = Language.En,
                CreatedAt = DateTime.UtcNow
            };

            var newUser = new User
            {
                Name = name,
                Email = email,
                PasswordHash = string.Empty,
                GoogleId = userInfo.Subject,
                Avatar = userInfo.Picture,
                Role = UserRole.SuperAdmin,
                Status = UserStatus.Active,
                TenantId = tenant.Id,
                EmailVerified = userInfo.EmailVerified,
                FailedLoginAttempts = 0,
                CreatedAt = DateTime.UtcNow
            };

            _db.Tenants.Add(tenant);
            _db.Users.Add(newUser);
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("New Google user registered: {Email}", email);

            var authResponse = await GenerateGoogleAuthResponseAsync(newUser, tenant.Id, true, tenant, ct);
            return Ok(ApiResponse<GoogleAuthResponse>.Ok(authResponse));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating new Google user: {Email}", userInfo.Email);
            return StatusCode(500, ApiResponse<GoogleAuthResponse>.Fail($"Failed to create user account: {ex.Message}"));
        }
    }

    private async Task<GoogleAuthResponse> GenerateGoogleAuthResponseAsync(
        User user,
        Guid tenantId,
        bool isNewUser,
        Tenant? tenant,
        CancellationToken ct,
        Branch? branch = null)
    {
        var (accessToken, expiresAt) = _tokenService.GenerateAccessToken(user, tenantId);
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays);
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var userDto = user.ToDto(branch);
        var tenantDto = tenant?.ToDto();

        return new GoogleAuthResponse(accessToken, refreshToken, expiresAt, userDto, isNewUser, tenantDto);
    }

    private static void UpdateGoogleUserFields(User user, GoogleUserInfo userInfo)
    {
        if (!string.IsNullOrEmpty(userInfo.Picture) && user.Avatar != userInfo.Picture)
        {
            user.Avatar = userInfo.Picture;
        }
        if (string.IsNullOrEmpty(user.GoogleId))
        {
            user.GoogleId = userInfo.Subject;
        }
        user.EmailVerified = userInfo.EmailVerified;
    }

    #endregion
}

#region Request/Response DTOs

public record CheckEmailRequest(string Email);
public record CheckEmailResponse(bool Exists);

#endregion
