using ThurayyaPharmacy.Domain.Common;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Domain.Entities;

/// <summary>
/// Customer for CRM
/// </summary>
public class Customer : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? CompanyName { get; set; }
    public string? Email { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? BillingAddress { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public CustomerType Type { get; set; } = CustomerType.Standard;
    public string? PaymentTerms { get; set; }
    public decimal CreditLimit { get; set; }
    public decimal Balance { get; set; }
    public PriceGroup? PriceGroup { get; set; }
    public string? BankAccount { get; set; }
    public Guid? AssignedSalesRepId { get; set; }
    public string? Source { get; set; }
    public string? Notes { get; set; }
    
    // Navigation
    public virtual User? AssignedSalesRep { get; set; }
    public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}

