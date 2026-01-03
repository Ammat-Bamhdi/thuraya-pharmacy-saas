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
    string Name,
    string GenericName,
    string Sku,
    decimal Price,
    decimal Cost,
    string Category,
    Guid? SupplierId,
    int MinStock = 10,
    string? Location = null
);

public record UpdateProductRequest(
    string? Name,
    string? GenericName,
    string? Sku,
    decimal? Price,
    decimal? Cost,
    string? Category,
    Guid? SupplierId,
    int? MinStock,
    string? Location
);

