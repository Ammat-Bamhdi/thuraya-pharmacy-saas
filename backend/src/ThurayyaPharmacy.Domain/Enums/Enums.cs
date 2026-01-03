namespace ThurayyaPharmacy.Domain.Enums;

public enum UserRole
{
    SuperAdmin,
    BranchAdmin,
    SectionAdmin
}

public enum UserStatus
{
    Active,
    Invited,
    Suspended
}

public enum POStatus
{
    Draft,
    Sent,
    Closed,
    Cancelled
}

public enum BillStatus
{
    Unpaid,
    Partial,
    Paid
}

public enum PaymentMethod
{
    BankTransfer,
    Cash,
    Check,
    Credit
}

public enum CustomerType
{
    Standard,
    Premium,
    VIP,
    Corporate,
    Insurance
}

public enum PriceGroup
{
    Retail,
    Wholesale,
    Distributor
}

public enum InvoiceStatus
{
    Paid,
    Pending,
    Overdue
}

public enum ExpenseCategory
{
    Rent,
    Utilities,
    Salaries,
    Supplies,
    Marketing
}

public enum SupplierStatus
{
    Active,
    Inactive
}

public enum Language
{
    En,
    Ar
}

