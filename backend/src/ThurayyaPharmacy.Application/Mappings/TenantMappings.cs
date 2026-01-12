using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;

namespace ThurayyaPharmacy.Application.Mappings;

/// <summary>
/// Extension methods for mapping Tenant entities to DTOs.
/// </summary>
public static class TenantMappings
{
    /// <summary>
    /// Maps a Tenant entity to TenantDto.
    /// </summary>
    public static TenantDto ToDto(this Tenant tenant)
    {
        ArgumentNullException.ThrowIfNull(tenant);

        return new TenantDto(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.Country,
            tenant.Currency,
            tenant.Language.ToString()
        );
    }

    /// <summary>
    /// Maps a Tenant entity to TenantDto, returning null if tenant is null.
    /// </summary>
    public static TenantDto? ToDtoOrNull(this Tenant? tenant)
    {
        return tenant?.ToDto();
    }
}
