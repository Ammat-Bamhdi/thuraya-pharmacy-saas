using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;

namespace ThurayyaPharmacy.API.Controllers;

/// <summary>
/// Controller for pharmacy branch management
/// </summary>
[Authorize(Roles = "SuperAdmin")]
public class BranchesController : BaseApiController
{
    private readonly IBranchService _branchService;
    private readonly ILogger<BranchesController> _logger;

    public BranchesController(IBranchService branchService, ILogger<BranchesController> logger)
    {
        _branchService = branchService;
        _logger = logger;
    }

    /// <summary>
    /// Get all branches with pagination, search and sorting
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<ThurayyaPharmacy.Application.DTOs.PaginatedResponse<BranchDto>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = "Name",
        [FromQuery] string sortOrder = "asc",
        CancellationToken ct = default)
    {
        try
        {
            var result = await _branchService.GetAllAsync(page, pageSize, search, sortBy, sortOrder, ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting branches");
            return BadRequestResponse<ThurayyaPharmacy.Application.DTOs.PaginatedResponse<BranchDto>>("Failed to retrieve branches");
        }
    }

    /// <summary>
    /// Get branch by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<BranchDto>>> GetById(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _branchService.GetByIdAsync(id, ct);
            return Success(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFoundResponse<BranchDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting branch {Id}", id);
            return BadRequestResponse<BranchDto>("Failed to retrieve branch");
        }
    }

    /// <summary>
    /// Create a new branch
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<BranchDto>>> Create([FromBody] ThurayyaPharmacy.Application.DTOs.CreateBranchRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _branchService.CreateAsync(request, ct);
            return Created(result, nameof(GetById), new { id = result.Id });
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse<BranchDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating branch");
            return BadRequestResponse<BranchDto>("Failed to create branch");
        }
    }

    /// <summary>
    /// Update an existing branch
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<BranchDto>>> Update(Guid id, [FromBody] ThurayyaPharmacy.Application.DTOs.UpdateBranchRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _branchService.UpdateAsync(id, request, ct);
            return Success(result, "Branch updated successfully");
        }
        catch (KeyNotFoundException ex)
        {
            return NotFoundResponse<BranchDto>(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse<BranchDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating branch {Id}", id);
            return BadRequestResponse<BranchDto>("Failed to update branch");
        }
    }

    /// <summary>
    /// Soft delete a branch
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _branchService.DeleteAsync(id, ct);
            if (!result) return NotFoundResponse<bool>("Branch not found");
            return Success(true, "Branch deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting branch {Id}", id);
            return BadRequestResponse<bool>("Failed to delete branch");
        }
    }

    /// <summary>
    /// Bulk create branches
    /// </summary>
    [HttpPost("bulk")]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<List<BranchDto>>>> BulkCreate([FromBody] BulkCreateBranchesRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _branchService.BulkCreateAsync(request.Items, ct);
            return Success(result, $"{result.Count} branches created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk creating branches");
            return BadRequestResponse<List<BranchDto>>("Failed to bulk create branches");
        }
    }
}

public class BulkCreateBranchesRequest
{
    public required List<ThurayyaPharmacy.Application.DTOs.CreateBranchRequest> Items { get; set; }
}
