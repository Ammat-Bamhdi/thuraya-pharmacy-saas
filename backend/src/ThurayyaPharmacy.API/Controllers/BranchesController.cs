using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;

namespace ThurayyaPharmacy.API.Controllers;

/// <summary>
/// Controller for pharmacy branch management.
/// 
/// Endpoints:
/// - GET  /api/branches              - List all branches (paginated) [SuperAdmin]
/// - GET  /api/branches/{id}         - Get single branch [SuperAdmin]
/// - POST /api/branches              - Create branch [SuperAdmin]
/// - PUT  /api/branches/{id}         - Update branch [SuperAdmin]
/// - DELETE /api/branches/{id}       - Delete branch [SuperAdmin]
/// - POST /api/branches/bulk         - Bulk create branches [SuperAdmin]
/// - GET  /api/branches/setup-status - Get setup completion status [Authenticated]
/// - GET  /api/branches/without-manager - Get branches needing managers [Authenticated]
/// - GET  /api/branches/available-managers - Get users eligible as managers [Authenticated]
/// - POST /api/branches/bulk-assign-manager - Assign manager to multiple branches [SuperAdmin]
/// 
/// Authorization: Method-level authorization - SuperAdmin for mutations, Authenticated for queries
/// </summary>
public class BranchesController : BaseApiController
{
    private readonly IBranchService _branchService;
    private readonly ILogger<BranchesController> _logger;

    public BranchesController(IBranchService branchService, ILogger<BranchesController> logger)
    {
        _branchService = branchService;
        _logger = logger;
    }

    // =========================================================================
    // CRUD OPERATIONS
    // =========================================================================

    /// <summary>
    /// Get all branches with pagination, search and sorting.
    /// </summary>
    /// <param name="page">Page number (1-based)</param>
    /// <param name="pageSize">Items per page (default: 50)</param>
    /// <param name="search">Search term for name or code</param>
    /// <param name="sortBy">Field to sort by (default: Name)</param>
    /// <param name="sortOrder">Sort direction: asc or desc</param>
    [HttpGet]
    [Authorize(Roles = "SuperAdmin")]
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
    [Authorize(Roles = "SuperAdmin")]
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
    [Authorize(Roles = "SuperAdmin")]
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
    [Authorize(Roles = "SuperAdmin")]
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
    [Authorize(Roles = "SuperAdmin")]
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

    // =========================================================================
    // BULK OPERATIONS
    // =========================================================================

    /// <summary>
    /// Bulk create branches.
    /// Rate limited: 5 requests per 5 minutes.
    /// Max request size: 10MB.
    /// </summary>
    /// <remarks>
    /// Use this endpoint to import branches from Excel or other sources.
    /// Branches are created atomically - all succeed or all fail.
    /// Duplicate codes are skipped automatically.
    /// </remarks>
    [HttpPost("bulk")]
    [Authorize(Roles = "SuperAdmin")]
    [EnableRateLimiting("bulk")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10MB limit
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

    /// <summary>
    /// Bulk assign a manager to multiple branches.
    /// </summary>
    /// <remarks>
    /// Use this endpoint from the manager assignment page to efficiently
    /// assign one manager to multiple branches at once.
    /// 
    /// Business Rules:
    /// - Manager must exist and be SuperAdmin or BranchAdmin role
    /// - All branches must exist (partial success is allowed)
    /// - Operation is atomic per transaction
    /// </remarks>
    [HttpPost("bulk-assign-manager")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult<ApiResponse<BulkAssignManagerResponse>>> BulkAssignManager(
        [FromBody] BulkAssignManagerRequest request, 
        CancellationToken ct)
    {
        try
        {
            if (request.BranchIds == null || request.BranchIds.Count == 0)
            {
                return BadRequestResponse<BulkAssignManagerResponse>("At least one branch ID is required");
            }

            var result = await _branchService.BulkAssignManagerAsync(request, ct);
            
            if (result.SuccessCount == 0 && result.Errors.Count > 0)
            {
                return BadRequestResponse<BulkAssignManagerResponse>(result.Errors.First());
            }

            var message = result.FailedCount == 0
                ? $"Successfully assigned manager to {result.SuccessCount} branch(es)"
                : $"Assigned manager to {result.SuccessCount} branch(es), {result.FailedCount} failed";

            return Success(result, message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk assigning manager");
            return BadRequestResponse<BulkAssignManagerResponse>("Failed to assign manager");
        }
    }

    // =========================================================================
    // SETUP STATUS OPERATIONS
    // =========================================================================

    /// <summary>
    /// Get setup completion status.
    /// </summary>
    /// <remarks>
    /// Returns statistics about manager assignment completion.
    /// Use this endpoint to:
    /// - Show setup progress card on dashboard
    /// - Determine if setup completion banner should be shown
    /// - Display completion percentage
    /// 
    /// Authorization: Any authenticated user can view setup status.
    /// </remarks>
    [HttpGet("setup-status")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<SetupStatusDto>>> GetSetupStatus(CancellationToken ct)
    {
        try
        {
            var result = await _branchService.GetSetupStatusAsync(ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting setup status");
            return BadRequestResponse<SetupStatusDto>("Failed to get setup status");
        }
    }

    /// <summary>
    /// Get branches that don't have a manager assigned.
    /// </summary>
    /// <remarks>
    /// Use this endpoint for the manager assignment page.
    /// Supports pagination and search for handling large datasets.
    /// 
    /// Authorization: Any authenticated user can view branches without managers.
    /// </remarks>
    /// <param name="page">Page number (1-based)</param>
    /// <param name="pageSize">Items per page (default: 50)</param>
    /// <param name="search">Search term for name, code, or location</param>
    [HttpGet("without-manager")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<BranchDto>>>> GetBranchesWithoutManager(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        try
        {
            var result = await _branchService.GetBranchesWithoutManagerAsync(page, pageSize, search, ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting branches without manager");
            return BadRequestResponse<PaginatedResponse<BranchDto>>("Failed to get branches");
        }
    }

    /// <summary>
    /// Get users available to be assigned as branch managers.
    /// </summary>
    /// <remarks>
    /// Returns lightweight DTOs optimized for dropdown selection.
    /// Only includes users with SuperAdmin or BranchAdmin role.
    /// Includes count of branches each user already manages.
    /// 
    /// Authorization: Any authenticated user can view available managers.
    /// </remarks>
    [HttpGet("available-managers")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<ManagerOptionDto>>>> GetAvailableManagers(CancellationToken ct)
    {
        try
        {
            var result = await _branchService.GetAvailableManagersAsync(ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting available managers");
            return BadRequestResponse<List<ManagerOptionDto>>("Failed to get available managers");
        }
    }
}

// =========================================================================
// REQUEST MODELS
// =========================================================================

/// <summary>
/// Request model for bulk branch creation.
/// </summary>
public class BulkCreateBranchesRequest
{
    /// <summary>
    /// List of branches to create.
    /// </summary>
    public required List<ThurayyaPharmacy.Application.DTOs.CreateBranchRequest> Items { get; set; }
}
