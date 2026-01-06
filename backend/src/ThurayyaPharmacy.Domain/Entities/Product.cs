using ThurayyaPharmacy.Domain.Common;

namespace ThurayyaPharmacy.Domain.Entities;

/// <summary>
/// Product in inventory
/// </summary>
public class Product : BranchEntity
{
    public string Name { get; set; } = string.Empty;
    public string GenericName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal Cost { get; set; }
    public decimal Margin { get; set; }
    public int Stock { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string Category { get; set; } = string.Empty;
    public Guid? SupplierId { get; set; }
    public int MinStock { get; set; } = 10;
    public string? Location { get; set; }
    
    // Navigation
    public virtual Supplier? Supplier { get; set; }
    public virtual ICollection<ProductBatch> Batches { get; set; } = new List<ProductBatch>();
}

/// <summary>
/// Product batch for tracking
/// </summary>
public class ProductBatch : BranchEntity
{
    public Guid ProductId { get; set; }
    public string? PoRef { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal Cost { get; set; }
    public DateTime ExpiryDate { get; set; }
    public DateTime ReceivedDate { get; set; }
    
    // Navigation
    public virtual Product Product { get; set; } = null!;
}

