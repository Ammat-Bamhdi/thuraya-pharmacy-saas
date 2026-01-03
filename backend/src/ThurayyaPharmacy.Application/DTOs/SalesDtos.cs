using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Application.DTOs;

// Customer DTOs
public record CustomerDto(
    Guid Id,
    string Name,
    string? CompanyName,
    string? Email,
    string Phone,
    string? BillingAddress,
    string? City,
    string? Country,
    CustomerType Type,
    string? PaymentTerms,
    decimal CreditLimit,
    decimal Balance,
    PriceGroup? PriceGroup,
    string? AssignedSalesRep
);

public record CreateCustomerRequest(
    string Name,
    string Phone,
    string? CompanyName = null,
    string? Email = null,
    string? BillingAddress = null,
    string? City = null,
    string? Country = null,
    CustomerType Type = CustomerType.Standard,
    string? PaymentTerms = null,
    decimal CreditLimit = 0,
    PriceGroup? PriceGroup = null
);

public record UpdateCustomerRequest(
    string? Name,
    string? Phone,
    string? CompanyName,
    string? Email,
    string? BillingAddress,
    string? City,
    string? Country,
    CustomerType? Type,
    string? PaymentTerms,
    decimal? CreditLimit,
    PriceGroup? PriceGroup
);

// Invoice DTOs
public record InvoiceDto(
    Guid Id,
    Guid CustomerId,
    string CustomerName,
    Guid BranchId,
    string BranchName,
    DateTime Date,
    InvoiceStatus Status,
    decimal Total,
    decimal PaidAmount,
    IEnumerable<InvoiceItemDto> Items
);

public record InvoiceItemDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    int Quantity,
    decimal Price
);

public record CreateInvoiceRequest(
    Guid CustomerId,
    Guid BranchId,
    IEnumerable<CreateInvoiceItemRequest> Items
);

public record CreateInvoiceItemRequest(
    Guid ProductId,
    int Quantity,
    decimal Price
);

