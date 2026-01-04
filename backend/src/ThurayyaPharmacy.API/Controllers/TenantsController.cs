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

        var dto = new TenantDto(tenant.Id, tenant.Name, tenant.Country, tenant.Currency, tenant.Language.ToString());
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

        var dto = new TenantDto(tenant.Id, tenant.Name, tenant.Country, tenant.Currency, tenant.Language.ToString());
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

