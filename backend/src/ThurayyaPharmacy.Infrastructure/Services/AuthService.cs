using System.Text.RegularExpressions;
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

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var transaction = await _db.Database.BeginTransactionAsync(ct);
            try
            {
                var slug = await GenerateUniqueSlugAsync(request.TenantName, ct);
                
                var tenant = new Tenant
                {
                    Name = request.TenantName,
                    Slug = slug,
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
        });
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

    public async Task<GoogleAuthResponse> GoogleAuthWithCodeAsync(string code, string? tenantSlug, bool isNewOrg, CancellationToken ct)
    {
        var tokenResponse = await _googleAuthService.ExchangeCodeForTokensAsync(code, ct);
        if (tokenResponse == null || string.IsNullOrEmpty(tokenResponse.IdToken))
            throw new UnauthorizedAccessException("Failed to exchange code for tokens");

        var userInfo = await _googleAuthService.VerifyTokenAsync(tokenResponse.IdToken);
        if (userInfo == null) throw new UnauthorizedAccessException("Invalid Google token from code");

        // Tenant-first authentication flow
        return await ProcessGoogleAuthWithTenantAsync(userInfo, tenantSlug, isNewOrg, ct);
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

    /// <summary>
    /// Tenant-first Google authentication flow.
    /// This method handles the new tenant-first auth where user must specify which org they're logging into.
    /// </summary>
    private async Task<GoogleAuthResponse> ProcessGoogleAuthWithTenantAsync(GoogleUserInfo userInfo, string? tenantSlug, bool isNewOrg, CancellationToken ct)
    {
        // Find existing user by email (globally unique)
        var existingUser = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == userInfo.Email && !u.IsDeleted, ct);

        // CASE 1: User is creating a NEW organization
        if (isNewOrg)
        {
            // If user already exists, they can't create a new org - email is globally unique
            if (existingUser != null)
            {
                var existingTenant = await _db.Tenants.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(t => t.Id == existingUser.TenantId && !t.IsDeleted, ct);
                
                throw new ArgumentException(
                    $"This email is already registered with organization '{existingTenant?.Name ?? "Unknown"}'. " +
                    "Please sign in to that organization instead.");
            }

            // Create new org and user
            return await HandleNewGoogleUserAsync(userInfo, null, null, null, ct);
        }

        // CASE 2: User is logging into an EXISTING organization
        if (string.IsNullOrEmpty(tenantSlug))
        {
            throw new ArgumentException("Organization slug is required for existing organization login");
        }

        // Find the target tenant
        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Slug == tenantSlug && !t.IsDeleted, ct);

        if (tenant == null)
        {
            throw new ArgumentException("Organization not found");
        }

        // CASE 2a: User exists - verify they belong to this org
        if (existingUser != null)
        {
            if (existingUser.TenantId != tenant.Id)
            {
                // User belongs to a different org
                var userTenant = await _db.Tenants.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(t => t.Id == existingUser.TenantId && !t.IsDeleted, ct);
                
                throw new UnauthorizedAccessException(
                    $"This email is registered with a different organization ('{userTenant?.Name ?? "Unknown"}'). " +
                    $"Please sign in to that organization or use a different email.");
            }

            // User belongs to this org - activate if invited, then log them in
            if (existingUser.Status == UserStatus.Invited)
            {
                existingUser.Status = UserStatus.Active;
                existingUser.GoogleId = userInfo.Subject;
                existingUser.EmailVerified = true;
                existingUser.Avatar = existingUser.Avatar ?? userInfo.Picture;
                _logger.LogInformation("Activated invited user {Email} for tenant {TenantSlug}", userInfo.Email, tenantSlug);
            }

            return await HandleExistingGoogleUserAsync(existingUser, userInfo, ct);
        }

        // CASE 2b: User does NOT exist - they haven't been invited
        throw new UnauthorizedAccessException(
            $"You are not a member of this organization. Please ask an administrator to invite you.");
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
        // Always create tenant and user for new Google users
        // Use defaults if tenant details not provided - onboarding will update them
        var actualTenantName = string.IsNullOrEmpty(tenantName) 
            ? $"{userInfo.Name ?? "My"}'s Organization" 
            : tenantName;
        var actualCountry = string.IsNullOrEmpty(country) ? "Unknown" : country;
        var actualCurrency = string.IsNullOrEmpty(currency) ? "USD" : currency;

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var transaction = await _db.Database.BeginTransactionAsync(ct);
            try
            {
                var slug = await GenerateUniqueSlugAsync(actualTenantName, ct);
                
                var tenant = new Tenant
                {
                    Name = actualTenantName,
                    Slug = slug,
                    Country = actualCountry,
                    Currency = actualCurrency,
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
        });
    }

    /// <summary>
    /// Generate a unique URL-friendly slug from the organization name.
    /// </summary>
    private async Task<string> GenerateUniqueSlugAsync(string name, CancellationToken ct)
    {
        // Convert to lowercase, replace spaces with hyphens, remove special chars
        var slug = name.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("'", "")
            .Replace("'", "");
        
        // Remove any remaining non-alphanumeric characters (except hyphens)
        slug = Regex.Replace(slug, @"[^a-z0-9\-]", "");
        
        // Remove consecutive hyphens
        slug = Regex.Replace(slug, @"-+", "-");
        
        // Trim hyphens from start and end
        slug = slug.Trim('-');
        
        // Ensure slug is not empty
        if (string.IsNullOrEmpty(slug))
        {
            slug = "org";
        }
        
        // Ensure uniqueness by appending number if needed
        var baseSlug = slug;
        var counter = 1;
        
        while (await _db.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Slug == slug && !t.IsDeleted, ct))
        {
            slug = $"{baseSlug}-{counter++}";
        }
        
        return slug;
    }
}