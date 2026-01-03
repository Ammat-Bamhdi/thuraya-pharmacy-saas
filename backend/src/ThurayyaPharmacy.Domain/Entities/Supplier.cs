using ThurayyaPharmacy.Domain.Common;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Domain.Entities;

/// <summary>
/// Supplier/Vendor
/// </summary>
public class Supplier : TenantEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? ZipCode { get; set; }
    public string? PaymentTerms { get; set; }
    public decimal CreditLimit { get; set; }
    public decimal CurrentBalance { get; set; }
    public int Rating { get; set; } = 5;
    public SupplierStatus Status { get; set; } = SupplierStatus.Active;
    public string? Category { get; set; }
    public string? Website { get; set; }
    public string? BankDetails { get; set; }
    public DateTime? LastOrderDate { get; set; }
    
    // Navigation
    public virtual ICollection<PurchaseOrder> PurchaseOrders { get; set; } = new List<PurchaseOrder>();
    public virtual ICollection<Product> Products { get; set; } = new List<Product>();
}

