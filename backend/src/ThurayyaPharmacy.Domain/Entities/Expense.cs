using ThurayyaPharmacy.Domain.Common;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Domain.Entities;

/// <summary>
/// Expense record
/// </summary>
public class Expense : TenantEntity
{
    public ExpenseCategory Category { get; set; }
    public decimal Amount { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public string? Description { get; set; }
    public string? AttachmentUrl { get; set; }
    public Guid? BranchId { get; set; }
    
    // Navigation
    public virtual Branch? Branch { get; set; }
}

