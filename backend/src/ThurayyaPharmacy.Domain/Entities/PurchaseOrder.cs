using ThurayyaPharmacy.Domain.Common;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Domain.Entities;

/// <summary>
/// Purchase Order
/// </summary>
public class PurchaseOrder : BranchEntity
{
    public Guid SupplierId { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public DateTime? ExpectedDeliveryDate { get; set; }
    public POStatus Status { get; set; } = POStatus.Draft;
    
    // Financials
    public decimal SubTotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public decimal GrandTotal { get; set; }
    
    // Details
    public string? TermsConditions { get; set; }
    public string? ShippingAddress { get; set; }
    public string? AttachmentName { get; set; }
    public string? AttachmentUrl { get; set; }
    
    // Assignment
    public Guid? AssignedToId { get; set; }
    
    // Navigation
    public virtual Supplier Supplier { get; set; } = null!;
    public virtual User? AssignedTo { get; set; }
    public virtual ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
    public virtual ICollection<PurchaseBill> Bills { get; set; } = new List<PurchaseBill>();
}

/// <summary>
/// Purchase Order Line Item
/// </summary>
public class PurchaseOrderItem : BranchEntity
{
    public Guid PurchaseOrderId { get; set; }
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public string? BatchNumber { get; set; }
    public DateTime? ExpiryDate { get; set; }
    
    // Navigation
    public virtual PurchaseOrder PurchaseOrder { get; set; } = null!;
    public virtual Product Product { get; set; } = null!;
}

