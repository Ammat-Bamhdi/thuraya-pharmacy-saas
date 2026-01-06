using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;

namespace ThurayyaPharmacy.Application.Mappings;

public static class CommonMappings
{

    public static BranchDto ToDto(this Branch branch)
    {
        return new BranchDto(
            branch.Id,
            branch.Name,
            branch.Code,
            branch.Location,
            branch.IsOfflineEnabled,
            branch.LicenseCount,
            branch.ManagerId,
            branch.Manager?.Name
        );
    }
}