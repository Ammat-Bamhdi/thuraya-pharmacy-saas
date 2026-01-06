using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Application.Mappings;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly IPasswordService _passwordService;
    private readonly IValidationService _validationService;
    private readonly IGoogleAuthService _googleAuthService;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        ApplicationDbContext db,
        ITokenService tokenService,
        IPasswordService passwordService,
        IValidationService validationService,
        IGoogleAuthService googleAuthService,
        ILogger<AuthService> logger)
    {
        _db = db;
        _tokenService = tokenService;
        _passwordService = passwordService;
        _validationService = validationService;
        _googleAuthService = googleAuthService;
        _logger = logger;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var validationErrors = _validationService.ValidateRegisterRequest(request);
        if (validationErrors.Any())
        {
            throw new ArgumentException(string.Join(", ", validationErrors));
        }

        var normalizedEmail = _validationService.NormalizeEmail(request.Email);
        if (await _db.Users.AnyAsync(u => u.Email == normalizedEmail, ct))
        {
            throw new ArgumentException("Email already exists");
        }

        using var transaction = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var tenant = new Tenant
            {
                Name = request.TenantName,
                Country = request.Country,
                Currency = request.Currency,
                CreatedAt = DateTime.UtcNow
            };

            _db.Tenants.Add(tenant);
            await _db.SaveChangesAsync(ct);

            var user = new User
            {
                Name = request.Name,
                Email = normalizedEmail,
                PasswordHash = _passwordService.HashPassword(request.Password),
                Role = UserRole.SuperAdmin,
                TenantId = tenant.Id,
                Status = UserStatus.Active,
                CreatedAt = DateTime.UtcNow,
                EmailVerified = false
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return await GenerateAuthResponseAsync(user, tenant.Id, ct);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(ct);
            _logger.LogError(ex, "Error during registration for {Email}", request.Email);
            throw;
        }
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var normalizedEmail = _validationService.NormalizeEmail(request.Email);
        var user = await _db.Users
            .IgnoreQueryFilters() // Login needs to find user across tenants or verify tenant
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail && !u.IsDeleted, ct);

        if (user == null)
            throw new UnauthorizedAccessException("Invalid email or password");

        if (user.LockoutEndTime > DateTime.UtcNow)
            throw new UnauthorizedAccessException($"Account is locked. Try again after {user.LockoutEndTime}");

        if (!_passwordService.VerifyPassword(request.Password, user.PasswordHash))
        {
            await HandleFailedLoginAsync(user, ct);
            throw new UnauthorizedAccessException("Invalid email or password");
        }

        await ResetLoginAttemptsAsync(user, ct);
        
        var branch = user.BranchId.HasValue 
            ? await _db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == user.BranchId, ct)
            : null;

        return await GenerateAuthResponseAsync(user, user.TenantId, ct, branch);
    }

    public async Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request, CancellationToken ct)
    {
        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken && !u.IsDeleted, ct);

        if (user == null || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            throw new UnauthorizedAccessException("Invalid or expired refresh token");

        var branch = user.BranchId.HasValue 
            ? await _db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == user.BranchId, ct)
            : null;

        return await GenerateAuthResponseAsync(user, user.TenantId, ct, branch);
    }

    public async Task<GoogleAuthResponse> GoogleAuthAsync(GoogleAuthRequest request, CancellationToken ct)
    {
        var userInfo = await _googleAuthService.VerifyTokenAsync(request.Credential);
        if (userInfo == null) throw new UnauthorizedAccessException("Invalid Google token");

        return await ProcessGoogleAuthAsync(userInfo, request.TenantName, request.Country, request.Currency, ct);
    }

    public async Task<GoogleAuthResponse> GoogleAuthWithCodeAsync(string code, CancellationToken ct)
    {
        var tokenResponse = await _googleAuthService.ExchangeCodeForTokensAsync(code, ct);
        if (tokenResponse == null || string.IsNullOrEmpty(tokenResponse.IdToken))
            throw new UnauthorizedAccessException("Failed to exchange code for tokens");

        var userInfo = await _googleAuthService.VerifyTokenAsync(tokenResponse.IdToken);
        if (userInfo == null) throw new UnauthorizedAccessException("Invalid Google token from code");

        // Use standard default registration details if not provided (or allow onboarding later)
        return await ProcessGoogleAuthAsync(userInfo, null, null, null, ct);
    }

    public async Task<MeResponse> GetMeAsync(Guid userId, CancellationToken ct)
    {
        var user = await _db.Users
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        if (user == null) throw new KeyNotFoundException("User not found");

        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == user.TenantId, ct);

        return new MeResponse(user.ToDto(user.Branch), tenant?.ToDto());
    }

    public async Task LogoutAsync(Guid userId, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user != null)
        {
            user.RefreshToken = null;
            user.RefreshTokenExpiryTime = null;
            await _db.SaveChangesAsync(ct);
        }
    }

    private async Task<AuthResponse> GenerateAuthResponseAsync(User user, Guid tenantId, CancellationToken ct, Branch? branch = null)
    {
        var (token, expiresAt) = _tokenService.GenerateAccessToken(user, tenantId);
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        user.LastLoginAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new AuthResponse(token, refreshToken, expiresAt, user.ToDto(branch));
    }

    private async Task HandleFailedLoginAsync(User user, CancellationToken ct)
    {
        user.FailedLoginAttempts = (user.FailedLoginAttempts ?? 0) + 1;
        if (user.FailedLoginAttempts >= 5)
        {
            user.LockoutEndTime = DateTime.UtcNow.AddMinutes(15);
        }
        await _db.SaveChangesAsync(ct);
    }

    private async Task ResetLoginAttemptsAsync(User user, CancellationToken ct)
    {
        user.FailedLoginAttempts = 0;
        user.LockoutEndTime = null;
        await _db.SaveChangesAsync(ct);
    }

    private async Task<GoogleAuthResponse> ProcessGoogleAuthAsync(GoogleUserInfo userInfo, string? tenantName, string? country, string? currency, CancellationToken ct)
    {
        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == userInfo.Email && !u.IsDeleted, ct);

        if (user != null)
        {
            return await HandleExistingGoogleUserAsync(user, userInfo, ct);
        }

        return await HandleNewGoogleUserAsync(userInfo, tenantName, country, currency, ct);
    }

    private async Task<GoogleAuthResponse> HandleExistingGoogleUserAsync(User user, GoogleUserInfo userInfo, CancellationToken ct)
    {
        user.GoogleId = userInfo.Subject;
        user.EmailVerified = true;
        if (string.IsNullOrEmpty(user.Avatar)) user.Avatar = userInfo.Picture;

        var branch = user.BranchId.HasValue 
            ? await _db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == user.BranchId, ct)
            : null;

        var auth = await GenerateAuthResponseAsync(user, user.TenantId, ct, branch);
        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == user.TenantId, ct);

        return new GoogleAuthResponse(auth.AccessToken, auth.RefreshToken, auth.ExpiresAt, auth.User, false, tenant?.ToDto());
    }

    private async Task<GoogleAuthResponse> HandleNewGoogleUserAsync(GoogleUserInfo userInfo, string? tenantName, string? country, string? currency, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(tenantName))
        {
            // If tenant details are missing, return isNewUser: true without creating anything yet
            // This allows the frontend to show the onboarding flow
            return new GoogleAuthResponse(
                string.Empty, // No access token yet
                string.Empty, // No refresh token yet
                DateTime.MinValue,
                new UserDto(Guid.Empty, userInfo.Name ?? userInfo.Email, userInfo.Email, UserRole.SuperAdmin, null, null, UserStatus.Active, userInfo.Picture),
                true,
                null);
        }

        using var transaction = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var tenant = new Tenant
            {
                Name = tenantName,
                Country = country ?? "Unknown",
                Currency = currency ?? "USD",
                CreatedAt = DateTime.UtcNow
            };

            _db.Tenants.Add(tenant);
            await _db.SaveChangesAsync(ct);

            var user = new User
            {
                Name = userInfo.Name ?? userInfo.Email,
                Email = userInfo.Email,
                GoogleId = userInfo.Subject,
                EmailVerified = true,
                Avatar = userInfo.Picture,
                Role = UserRole.SuperAdmin,
                TenantId = tenant.Id,
                Status = UserStatus.Active,
                CreatedAt = DateTime.UtcNow
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            var auth = await GenerateAuthResponseAsync(user, tenant.Id, ct);
            return new GoogleAuthResponse(auth.AccessToken, auth.RefreshToken, auth.ExpiresAt, auth.User, true, tenant.ToDto());
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(ct);
            _logger.LogError(ex, "Error during Google registration for {Email}", userInfo.Email);
            throw;
        }
    }
}