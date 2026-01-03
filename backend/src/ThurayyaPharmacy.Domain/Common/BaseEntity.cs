using ThurayyaPharmacy.Domain.Entities;

namespace ThurayyaPharmacy.Domain.Common;

/// <summary>
/// Base entity with common audit fields
/// </summary>
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTime? ModifiedAt { get; set; }
    public string? ModifiedBy { get; set; }
    public bool IsDeleted { get; set; } = false;
}

/// <summary>
/// Base entity scoped to a tenant
/// </summary>
public abstract class TenantEntity : BaseEntity
{
    public Guid TenantId { get; set; }
    public virtual Tenant Tenant { get; set; } = null!;
}

/// <summary>
/// Base entity scoped to a branch
/// </summary>
public abstract class BranchEntity : TenantEntity
{
    public Guid BranchId { get; set; }
    public virtual Branch Branch { get; set; } = null!;
}

