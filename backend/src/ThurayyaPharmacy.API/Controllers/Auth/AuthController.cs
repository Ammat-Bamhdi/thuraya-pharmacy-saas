using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers.Auth;

/// <summary>
/// Controller for authentication and user management
/// </summary>
[Route("api/auth")]
[EnableRateLimiting("auth")]
public class AuthController : BaseApiController
{
    private readonly IAuthService _authService;
    private readonly ApplicationDbContext _db;
    private readonly IValidationService _validationService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthService authService,
        ApplicationDbContext db,
        IValidationService validationService,
        ILogger<AuthController> logger)
    {
        _authService = authService;
        _db = db;
        _validationService = validationService;
        _logger = logger;
    }

    /// <summary>
    /// Register a new organization and administrator
    /// </summary>
    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken ct)
    {
        try
        {
            var result = await _authService.RegisterAsync(request, ct);
            return Success(result, "Registration successful");
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse<AuthResponse>(ex.Message);
        }
    }

    /// <summary>
    /// Authenticate with email and password
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login(
        [FromBody] LoginRequest request,
        CancellationToken ct)
    {
        try
        {
            var result = await _authService.LoginAsync(request, ct);
            return Success(result, "Login successful");
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, ex.Message));
        }
    }

    /// <summary>
    /// Check if email is already registered
    /// </summary>
    [HttpPost("check-email")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<CheckEmailResponse>>> CheckEmail(
        [FromBody] CheckEmailRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.Email) || !_validationService.IsValidEmail(request.Email))
        {
            return Success(new CheckEmailResponse(false, false), "Invalid email format");
        }

        var normalizedEmail = _validationService.NormalizeEmail(request.Email);
        var exists = await _db.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Email == normalizedEmail && !u.IsDeleted, ct);

        return Success(new CheckEmailResponse(exists, true));
    }

    /// <summary>
    /// Authenticate using Google ID Token
    /// </summary>
    [HttpPost("google")]
    public async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> GoogleAuth(
        [FromBody] GoogleAuthRequest request,
        CancellationToken ct)
    {
        try
        {
            var result = await _authService.GoogleAuthAsync(request, ct);
            return Success(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new ApiResponse<GoogleAuthResponse>(false, null, ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse<GoogleAuthResponse>(ex.Message);
        }
    }

    /// <summary>
    /// Authenticate using Google Authorization Code (tenant-first flow)
    /// </summary>
    /// <remarks>
    /// For existing org login: pass tenantSlug and isNewOrg=false
    /// For new org creation: pass isNewOrg=true (tenantSlug is ignored)
    /// </remarks>
    [HttpPost("google-code")]
    public async Task<ActionResult<ApiResponse<GoogleAuthResponse>>> GoogleAuthWithCode(
        [FromBody] GoogleCodeRequest request,
        CancellationToken ct)
    {
        try
        {
            var result = await _authService.GoogleAuthWithCodeAsync(
                request.Code, 
                request.TenantSlug, 
                request.IsNewOrg, 
                ct);
            return Success(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new ApiResponse<GoogleAuthResponse>(false, null, ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse<GoogleAuthResponse>(ex.Message);
        }
    }

    /// <summary>
    /// Refresh access token using refresh token
    /// </summary>
    [HttpPost("refresh-token")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> RefreshToken(
        [FromBody] RefreshTokenRequest request,
        CancellationToken ct)
    {
        try
        {
            var result = await _authService.RefreshTokenAsync(request, ct);
            return Success(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, ex.Message));
        }
    }

    /// <summary>
    /// Get current authenticated user details
    /// </summary>
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<MeResponse>>> GetCurrentUser(CancellationToken ct)
    {
        try
        {
            var userId = GetUserId();
            var result = await _authService.GetMeAsync(userId, ct);
            return Success(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFoundResponse<MeResponse>(ex.Message);
        }
    }

    /// <summary>
    /// Logout and invalidate refresh token
    /// </summary>
    [Authorize]
    [HttpPost("logout")]
    public async Task<ActionResult<ApiResponse<bool>>> Logout(CancellationToken ct)
    {
        var userId = GetUserId();
        await _authService.LogoutAsync(userId, ct);
        return Success(true, "Logged out successfully");
    }
}

public record CheckEmailRequest(string Email);
public record CheckEmailResponse(bool Exists, bool IsValid);
