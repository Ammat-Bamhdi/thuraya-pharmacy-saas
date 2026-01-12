using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[Authorize]
public class TenantsController : BaseApiController
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<TenantsController> _logger;

    public TenantsController(ApplicationDbContext db, ILogger<TenantsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get tenant by slug (public endpoint for org selection)
    /// Used by frontend to validate org slug before login
    /// </summary>
    [HttpGet("by-slug/{slug}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<TenantPublicDto>>> GetBySlug(string slug)
    {
        var tenant = await _db.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Slug == slug && !t.IsDeleted);

        if (tenant == null)
        {
            return NotFound(new ApiResponse<TenantPublicDto>(false, null, "Organization not found"));
        }

        var dto = new TenantPublicDto(tenant.Id, tenant.Name, tenant.Slug);
        return Ok(new ApiResponse<TenantPublicDto>(true, dto));
    }

    /// <summary>
    /// Check if a slug is available (public endpoint for registration)
    /// </summary>
    [HttpGet("check-slug/{slug}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<bool>>> CheckSlugAvailable(string slug)
    {
        var exists = await _db.Tenants
            .IgnoreQueryFilters()
            .AnyAsync(t => t.Slug == slug && !t.IsDeleted);

        return Ok(new ApiResponse<bool>(true, !exists, exists ? "Slug already taken" : "Slug available"));
    }

    /// <summary>
    /// Get the current tenant's details
    /// </summary>
    [HttpGet("current")]
    public async Task<ActionResult<ApiResponse<TenantDto>>> GetCurrent()
    {
        var tenantId = GetTenantId();
        var tenant = await _db.Tenants.FindAsync(tenantId);

        if (tenant == null)
        {
            return NotFound(new ApiResponse<TenantDto>(false, null, "Tenant not found"));
        }

        var dto = new TenantDto(tenant.Id, tenant.Name, tenant.Slug, tenant.Country, tenant.Currency, tenant.Language.ToString());
        return Ok(new ApiResponse<TenantDto>(true, dto));
    }

    /// <summary>
    /// Update the current tenant's details (used during onboarding)
    /// </summary>
    [HttpPut("current")]
    public async Task<ActionResult<ApiResponse<TenantDto>>> UpdateCurrent([FromBody] UpdateTenantRequest request)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        
        var tenant = await _db.Tenants.FindAsync(tenantId);

        if (tenant == null)
        {
            return NotFound(new ApiResponse<TenantDto>(false, null, "Tenant not found"));
        }

        // Update tenant details
        if (!string.IsNullOrEmpty(request.Name))
            tenant.Name = request.Name;
        if (!string.IsNullOrEmpty(request.Country))
            tenant.Country = request.Country;
        if (!string.IsNullOrEmpty(request.Currency))
            tenant.Currency = request.Currency;
        if (!string.IsNullOrEmpty(request.Language))
        {
            // Parse language string to enum
            if (Enum.TryParse<Language>(request.Language, true, out var lang))
            {
                tenant.Language = lang;
            }
        }

        tenant.ModifiedAt = DateTime.UtcNow;
        tenant.ModifiedBy = userId.ToString();

        await _db.SaveChangesAsync();

        var dto = new TenantDto(tenant.Id, tenant.Name, tenant.Slug, tenant.Country, tenant.Currency, tenant.Language.ToString());
        return Ok(new ApiResponse<TenantDto>(true, dto));
    }
}

// DTOs - TenantDto is defined in Application.DTOs.CommonDtos
public class UpdateTenantRequest
{
    public string? Name { get; set; }
    public string? Country { get; set; }
    public string? Currency { get; set; }
    public string? Language { get; set; }
}

/// <summary>
/// Public tenant info (no sensitive data)
/// </summary>
public record TenantPublicDto(Guid Id, string Name, string Slug);
