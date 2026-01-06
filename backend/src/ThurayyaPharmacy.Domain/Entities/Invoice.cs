using ThurayyaPharmacy.Domain.Common;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Domain.Entities;

/// <summary>
/// Sales Invoice
/// </summary>
public class Invoice : BranchEntity
{
    public Guid CustomerId { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Pending;
    public decimal Total { get; set; }
    public decimal PaidAmount { get; set; }
    public string? Note { get; set; }
    
    // Navigation
    public virtual Customer Customer { get; set; } = null!;
    public virtual ICollection<InvoiceItem> Items { get; set; } = new List<InvoiceItem>();
}

/// <summary>
/// Invoice Line Item
/// </summary>
public class InvoiceItem : BranchEntity
{
    public Guid InvoiceId { get; set; }
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    
    // Navigation
    public virtual Invoice Invoice { get; set; } = null!;
    public virtual Product Product { get; set; } = null!;
}

