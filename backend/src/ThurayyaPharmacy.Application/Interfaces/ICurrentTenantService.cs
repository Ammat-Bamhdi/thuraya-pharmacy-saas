namespace ThurayyaPharmacy.Application.Interfaces;

public interface ICurrentTenantService
{
    Guid? TenantId { get; }
    Guid? UserId { get; }
}