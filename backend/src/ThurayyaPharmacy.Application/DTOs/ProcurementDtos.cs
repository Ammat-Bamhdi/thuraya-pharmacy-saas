using System.ComponentModel.DataAnnotations;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.Application.DTOs;

// Supplier DTOs
public record SupplierDto(
    Guid Id,
    string Code,
    string Name,
    string? ContactPerson,
    string? Email,
    string? Phone,
    string? Address,
    string? City,
    string? Country,
    string? PaymentTerms,
    decimal CreditLimit,
    decimal CurrentBalance,
    int Rating,
    SupplierStatus Status,
    string? Category,
    DateTime? LastOrderDate
);

public record CreateSupplierRequest(
    [Required(ErrorMessage = "Supplier code is required")]
    [StringLength(20, MinimumLength = 2, ErrorMessage = "Code must be between 2 and 20 characters")]
    string Code,
    
    [Required(ErrorMessage = "Supplier name is required")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 200 characters")]
    string Name,
    
    [StringLength(100)]
    string? ContactPerson,
    
    [EmailAddress(ErrorMessage = "Invalid email format")]
    string? Email,
    
    [Phone(ErrorMessage = "Invalid phone number")]
    [StringLength(20)]
    string? Phone,
    
    [StringLength(500)]
    string? Address,
    
    [StringLength(100)]
    string? City,
    
    [StringLength(100)]
    string? Country,
    
    [StringLength(200)]
    string? PaymentTerms = null,
    
    [Range(0, double.MaxValue, ErrorMessage = "Credit limit must be non-negative")]
    decimal CreditLimit = 0,
    
    [StringLength(100)]
    string? Category = null
);

public record UpdateSupplierRequest(
    string? Name,
    string? ContactPerson,
    string? Email,
    string? Phone,
    string? Address,
    string? City,
    string? Country,
    string? PaymentTerms,
    decimal? CreditLimit,
    int? Rating,
    SupplierStatus? Status,
    string? Category
);

// Purchase Order DTOs
public record PurchaseOrderDto(
    Guid Id,
    Guid SupplierId,
    string SupplierName,
    Guid BranchId,
    string BranchName,
    DateTime Date,
    DateTime? ExpectedDeliveryDate,
    POStatus Status,
    decimal SubTotal,
    decimal Tax,
    decimal Discount,
    decimal GrandTotal,
    string? CreatedBy,
    string? AssignedTo,
    IEnumerable<PurchaseOrderItemDto> Items
);

public record PurchaseOrderItemDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    int Quantity,
    decimal UnitCost,
    string? BatchNumber,
    DateTime? ExpiryDate
);

public record CreatePurchaseOrderRequest(
    Guid SupplierId,
    Guid BranchId,
    DateTime? ExpectedDeliveryDate,
    decimal Tax = 0,
    decimal Discount = 0,
    string? TermsConditions = null,
    string? ShippingAddress = null,
    Guid? AssignedToId = null,
    IEnumerable<CreatePurchaseOrderItemRequest> Items = null!
);

public record CreatePurchaseOrderItemRequest(
    Guid ProductId,
    int Quantity,
    decimal UnitCost,
    string? BatchNumber = null,
    DateTime? ExpiryDate = null
);

// Purchase Bill DTOs
public record PurchaseBillDto(
    Guid Id,
    Guid PurchaseOrderId,
    Guid SupplierId,
    string SupplierName,
    string BillNumber,
    DateTime BillDate,
    DateTime DueDate,
    DateTime ReceivedDate,
    decimal TotalAmount,
    decimal PaidAmount,
    BillStatus Status,
    string? Note,
    string? AttachmentUrl,
    IEnumerable<PaymentRecordDto> Payments
);

public record PaymentRecordDto(
    Guid Id,
    DateTime Date,
    decimal Amount,
    PaymentMethod Method,
    string? Reference,
    string? Note
);

public record CreatePaymentRequest(
    decimal Amount,
    PaymentMethod Method,
    string? Reference = null,
    string? Note = null
);

