using ThurayyaPharmacy.Domain.Common;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Domain.Entities;

/// <summary>
/// Purchase Bill / Supplier Invoice
/// </summary>
public class PurchaseBill : TenantEntity
{
    public Guid PurchaseOrderId { get; set; }
    public Guid SupplierId { get; set; }
    public string BillNumber { get; set; } = string.Empty;
    public DateTime BillDate { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime ReceivedDate { get; set; }
    
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public BillStatus Status { get; set; } = BillStatus.Unpaid;
    
    public string? Note { get; set; }
    public string? AttachmentName { get; set; }
    public string? AttachmentUrl { get; set; }
    
    // Assignment
    public Guid? AssignedToId { get; set; }
    
    // Navigation
    public virtual PurchaseOrder PurchaseOrder { get; set; } = null!;
    public virtual Supplier Supplier { get; set; } = null!;
    public virtual User? AssignedTo { get; set; }
    public virtual ICollection<PaymentRecord> Payments { get; set; } = new List<PaymentRecord>();
}

/// <summary>
/// Payment Record
/// </summary>
public class PaymentRecord : TenantEntity
{
    public Guid PurchaseBillId { get; set; }
    public DateTime Date { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public string? Reference { get; set; }
    public string? AttachmentName { get; set; }
    public string? AttachmentUrl { get; set; }
    public string? Note { get; set; }
    
    // Navigation
    public virtual PurchaseBill PurchaseBill { get; set; } = null!;
}

