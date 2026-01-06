using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Domain.Enums;

namespace ThurayyaPharmacy.API.Controllers;

/// <summary>
/// Controller for supplier and procurement management
/// </summary>
[Authorize]
public class SuppliersController : BaseApiController
{
    private readonly ISupplierService _supplierService;
    private readonly ILogger<SuppliersController> _logger;

    public SuppliersController(ISupplierService supplierService, ILogger<SuppliersController> logger)
    {
        _supplierService = supplierService;
        _logger = logger;
    }

    /// <summary>
    /// Get all suppliers with pagination and filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<ThurayyaPharmacy.Application.DTOs.PaginatedResponse<SupplierDto>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] SupplierStatus? status = null,
        [FromQuery] string? category = null,
        [FromQuery] string? sortBy = "Name",
        [FromQuery] string sortOrder = "asc",
        CancellationToken ct = default)
    {
        try
        {
            var result = await _supplierService.GetAllAsync(page, pageSize, search, status, category, sortBy, sortOrder, ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting suppliers");
            return BadRequestResponse<ThurayyaPharmacy.Application.DTOs.PaginatedResponse<SupplierDto>>("Failed to retrieve suppliers");
        }
    }

    /// <summary>
    /// Get supplier by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<SupplierDto>>> GetById(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _supplierService.GetByIdAsync(id, ct);
            return Success(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFoundResponse<SupplierDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting supplier {Id}", id);
            return BadRequestResponse<SupplierDto>("Failed to retrieve supplier");
        }
    }

    /// <summary>
    /// Create a new supplier
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<SupplierDto>>> Create([FromBody] CreateSupplierRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _supplierService.CreateAsync(request, ct);
            return Created(result, nameof(GetById), new { id = result.Id });
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse<SupplierDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating supplier");
            return BadRequestResponse<SupplierDto>("Failed to create supplier");
        }
    }

    /// <summary>
    /// Update an existing supplier
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<SupplierDto>>> Update(Guid id, [FromBody] UpdateSupplierRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _supplierService.UpdateAsync(id, request, ct);
            return Success(result, "Supplier updated successfully");
        }
        catch (KeyNotFoundException ex)
        {
            return NotFoundResponse<SupplierDto>(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse<SupplierDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating supplier {Id}", id);
            return BadRequestResponse<SupplierDto>("Failed to update supplier");
        }
    }

    /// <summary>
    /// Soft delete a supplier
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _supplierService.DeleteAsync(id, ct);
            if (!result) return NotFoundResponse<bool>("Supplier not found");
            return Success(true, "Supplier deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting supplier {Id}", id);
            return BadRequestResponse<bool>("Failed to delete supplier");
        }
    }

    /// <summary>
    /// Get supplier statistics
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<SupplierStatsDto>>> GetStats(CancellationToken ct)
    {
        try
        {
            var result = await _supplierService.GetStatsAsync(ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting supplier stats");
            return BadRequestResponse<SupplierStatsDto>("Failed to retrieve supplier statistics");
        }
    }
}
