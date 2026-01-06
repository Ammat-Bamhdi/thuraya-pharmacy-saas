using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;

namespace ThurayyaPharmacy.Application.Mappings;

public static class InvoiceMappings
{
    public static InvoiceDto ToDto(this Invoice invoice)
    {
        return new InvoiceDto(
            invoice.Id,
            invoice.CustomerId,
            invoice.Customer?.Name ?? "Unknown",
            invoice.BranchId,
            invoice.Branch?.Name ?? "Unknown",
            invoice.Date,
            invoice.Status,
            invoice.Total,
            invoice.PaidAmount,
            invoice.Items.Select(i => i.ToDto())
        );
    }

    public static InvoiceItemDto ToDto(this InvoiceItem item)
    {
        return new InvoiceItemDto(
            item.Id,
            item.ProductId,
            item.Product?.Name ?? "Unknown",
            item.Quantity,
            item.Price
        );
    }
}