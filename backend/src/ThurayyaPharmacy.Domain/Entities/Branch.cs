using ThurayyaPharmacy.Domain.Common;

namespace ThurayyaPharmacy.Domain.Entities;

/// <summary>
/// Pharmacy branch
/// </summary>
public class Branch : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public bool IsOfflineEnabled { get; set; } = false;
    public int LicenseCount { get; set; } = 1;
    public Guid? ManagerId { get; set; }
    
    // Navigation
    public virtual User? Manager { get; set; }
    public virtual ICollection<User> Users { get; set; } = new List<User>();
    public virtual ICollection<Product> Products { get; set; } = new List<Product>();
    public virtual ICollection<PurchaseOrder> PurchaseOrders { get; set; } = new List<PurchaseOrder>();
    public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}

