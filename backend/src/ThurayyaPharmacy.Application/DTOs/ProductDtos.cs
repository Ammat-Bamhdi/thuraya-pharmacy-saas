using System.ComponentModel.DataAnnotations;

namespace ThurayyaPharmacy.Application.DTOs;

public record ProductDto(
    Guid Id,
    Guid BranchId,
    string Name,
    string GenericName,
    string Sku,
    decimal Price,
    decimal Cost,
    decimal Margin,
    int Stock,
    DateTime? ExpiryDate,
    string Category,
    Guid? SupplierId,
    string? SupplierName,
    int MinStock,
    string? Location,
    IEnumerable<ProductBatchDto> Batches
);

public record ProductBatchDto(
    Guid Id,
    string? PoRef,
    string BatchNumber,
    int Quantity,
    decimal Cost,
    DateTime ExpiryDate,
    DateTime ReceivedDate
);

public record CreateProductRequest(
    [Required(ErrorMessage = "Product name is required")]
    [StringLength(300, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 300 characters")]
    string Name,
    
    [StringLength(300)]
    string GenericName,
    
    [Required(ErrorMessage = "SKU is required")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "SKU must be between 2 and 50 characters")]
    string Sku,
    
    [Range(0, double.MaxValue, ErrorMessage = "Price must be non-negative")]
    decimal Price,
    
    [Range(0, double.MaxValue, ErrorMessage = "Cost must be non-negative")]
    decimal Cost,
    
    [StringLength(100)]
    string Category,
    
    Guid? SupplierId,
    
    [Range(0, int.MaxValue, ErrorMessage = "Minimum stock must be non-negative")]
    int MinStock = 10,
    
    [StringLength(200)]
    string? Location = null,
    
    Guid? BranchId = null,
    
    [Range(0, int.MaxValue, ErrorMessage = "Initial stock must be non-negative")]
    int InitialStock = 0,
    
    DateTime? ExpiryDate = null
);

public record UpdateProductRequest(
    [StringLength(300, MinimumLength = 2)]
    string? Name,
    
    [StringLength(300)]
    string? GenericName,
    
    [StringLength(50, MinimumLength = 2)]
    string? Sku,
    
    [Range(0, double.MaxValue)]
    decimal? Price,
    
    [Range(0, double.MaxValue)]
    decimal? Cost,
    
    [StringLength(100)]
    string? Category,
    
    Guid? SupplierId,
    
    [Range(0, int.MaxValue)]
    int? MinStock,
    
    [StringLength(200)]
    string? Location,
    
    DateTime? ExpiryDate
);

public record ProductStatsDto(
    int TotalProducts,
    int LowStockCount,
    int ExpiringSoonCount,
    decimal TotalInventoryValue,
    int TotalCategories,
    int TotalSuppliers
);

