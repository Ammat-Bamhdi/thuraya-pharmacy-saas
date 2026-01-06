using ThurayyaPharmacy.Application.DTOs;

namespace ThurayyaPharmacy.Application.Interfaces;

public interface IInvoiceService
{
    Task<PaginatedResponse<InvoiceDto>> GetAllAsync(
        int page,
        int pageSize,
        Guid? branchId,
        Guid? customerId,
        ThurayyaPharmacy.Domain.Enums.InvoiceStatus? status,
        DateTime? fromDate,
        DateTime? toDate,
        string? sortBy,
        string sortOrder,
        CancellationToken ct);

    Task<InvoiceDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<InvoiceDto> CreateAsync(CreateInvoiceRequest request, Guid userId, CancellationToken ct);
    Task<InvoiceDto> UpdateStatusAsync(Guid id, ThurayyaPharmacy.Domain.Enums.InvoiceStatus status, CancellationToken ct);
    Task<InvoiceStatsDto> GetStatsAsync(Guid? branchId, DateTime? fromDate, DateTime? toDate, CancellationToken ct);
    Task<TodaySalesDto> GetTodaySalesAsync(Guid? branchId, CancellationToken ct);
}