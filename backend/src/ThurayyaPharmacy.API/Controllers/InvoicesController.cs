using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.API.Controllers;

/// <summary>
/// Controller for sales and invoice management
/// </summary>
[Authorize]
public class InvoicesController : BaseApiController
{
    private readonly IInvoiceService _invoiceService;
    private readonly ILogger<InvoicesController> _logger;

    public InvoicesController(IInvoiceService invoiceService, ILogger<InvoicesController> logger)
    {
        _invoiceService = invoiceService;
        _logger = logger;
    }

    /// <summary>
    /// Get all invoices with pagination and filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<ThurayyaPharmacy.Application.DTOs.PaginatedResponse<InvoiceDto>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] Guid? branchId = null,
        [FromQuery] Guid? customerId = null,
        [FromQuery] InvoiceStatus? status = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? sortBy = "Date",
        [FromQuery] string sortOrder = "desc",
        CancellationToken ct = default)
    {
        try
        {
            var result = await _invoiceService.GetAllAsync(page, pageSize, branchId, customerId, status, fromDate, toDate, sortBy, sortOrder, ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invoices");
            return BadRequestResponse<ThurayyaPharmacy.Application.DTOs.PaginatedResponse<InvoiceDto>>("Failed to retrieve invoices");
        }
    }

    /// <summary>
    /// Get invoice by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<InvoiceDto>>> GetById(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _invoiceService.GetByIdAsync(id, ct);
            return Success(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFoundResponse<InvoiceDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invoice {Id}", id);
            return BadRequestResponse<InvoiceDto>("Failed to retrieve invoice");
        }
    }

    /// <summary>
    /// Create a new invoice
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<InvoiceDto>>> Create([FromBody] ThurayyaPharmacy.Application.DTOs.CreateInvoiceRequest request, CancellationToken ct)
    {
        try
        {
            var userId = GetUserId();
            var result = await _invoiceService.CreateAsync(request, userId, ct);
            return Created(result, nameof(GetById), new { id = result.Id });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFoundResponse<InvoiceDto>(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequestResponse<InvoiceDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating invoice");
            return BadRequestResponse<InvoiceDto>("Failed to create invoice");
        }
    }

    /// <summary>
    /// Update invoice status
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<InvoiceDto>>> UpdateStatus(Guid id, [FromBody] UpdateInvoiceStatusRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _invoiceService.UpdateStatusAsync(id, request.Status, ct);
            return Success(result, "Invoice status updated successfully");
        }
        catch (KeyNotFoundException ex)
        {
            return NotFoundResponse<InvoiceDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating invoice status {Id}", id);
            return BadRequestResponse<InvoiceDto>("Failed to update invoice status");
        }
    }

    /// <summary>
    /// Get invoice statistics
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<InvoiceStatsDto>>> GetStats(
        [FromQuery] Guid? branchId = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        try
        {
            var result = await _invoiceService.GetStatsAsync(branchId, fromDate, toDate, ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invoice stats");
            return BadRequestResponse<InvoiceStatsDto>("Failed to retrieve sales statistics");
        }
    }

    /// <summary>
    /// Get today's sales summary
    /// </summary>
    [HttpGet("today-sales")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<TodaySalesDto>>> GetTodaySales([FromQuery] Guid? branchId, CancellationToken ct)
    {
        try
        {
            var result = await _invoiceService.GetTodaySalesAsync(branchId, ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting today sales");
            return BadRequestResponse<TodaySalesDto>("Failed to retrieve today's sales");
        }
    }
}

public class UpdateInvoiceStatusRequest
{
    public InvoiceStatus Status { get; set; }
}
