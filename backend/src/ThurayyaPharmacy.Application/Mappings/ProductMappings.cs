using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;

namespace ThurayyaPharmacy.Application.Mappings;

public static class ProductMappings
{
    public static ProductDto ToDto(this Product product)
    {
        return new ProductDto(
            product.Id,
            product.BranchId,
            product.Name,
            product.GenericName,
            product.Sku,
            product.Price,
            product.Cost,
            product.Margin,
            product.Stock,
            product.ExpiryDate,
            product.Category,
            product.SupplierId,
            product.Supplier?.Name,
            product.MinStock,
            product.Location,
            product.Batches.Select(b => b.ToDto())
        );
    }

    public static ProductBatchDto ToDto(this ProductBatch batch)
    {
        return new ProductBatchDto(
            batch.Id,
            batch.PoRef,
            batch.BatchNumber,
            batch.Quantity,
            batch.Cost,
            batch.ExpiryDate,
            batch.ReceivedDate
        );
    }
}