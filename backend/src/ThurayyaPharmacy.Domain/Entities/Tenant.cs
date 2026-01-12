using ThurayyaPharmacy.Domain.Common;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Domain.Entities;

/// <summary>
/// Multi-tenant organization
/// </summary>
public class Tenant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// URL-friendly unique identifier for the tenant (e.g., "acme-pharmacy")
    /// Used in path-based routing: thuraya.io/{slug}
    /// </summary>
    public string Slug { get; set; } = string.Empty;
    
    public string Country { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    public Language Language { get; set; } = Language.En;
    
    // Navigation
    public virtual ICollection<Branch> Branches { get; set; } = new List<Branch>();
    public virtual ICollection<User> Users { get; set; } = new List<User>();
}

