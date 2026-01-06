using System.ComponentModel.DataAnnotations;
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
    [Required(ErrorMessage = "Customer name is required")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 200 characters")]
    string Name,
    
    [Required(ErrorMessage = "Phone number is required")]
    [Phone(ErrorMessage = "Invalid phone number")]
    [StringLength(20)]
    string Phone,
    
    [StringLength(200)]
    string? CompanyName = null,
    
    [EmailAddress(ErrorMessage = "Invalid email format")]
    string? Email = null,
    
    [StringLength(500)]
    string? BillingAddress = null,
    
    [StringLength(100)]
    string? City = null,
    
    [StringLength(100)]
    string? Country = null,
    
    CustomerType Type = CustomerType.Standard,
    
    [StringLength(200)]
    string? PaymentTerms = null,
    
    [Range(0, double.MaxValue, ErrorMessage = "Credit limit must be non-negative")]
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

