using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;

namespace ThurayyaPharmacy.Application.Mappings;

public static class SupplierMappings
{
    public static SupplierDto ToDto(this Supplier supplier)
    {
        return new SupplierDto(
            supplier.Id,
            supplier.Code,
            supplier.Name,
            supplier.ContactPerson,
            supplier.Email,
            supplier.Phone,
            supplier.Address,
            supplier.City,
            supplier.State,
            supplier.Country,
            supplier.ZipCode,
            supplier.PaymentTerms,
            supplier.CreditLimit,
            supplier.CurrentBalance,
            supplier.Rating,
            supplier.Status,
            supplier.Category,
            supplier.LastOrderDate
        );
    }
}