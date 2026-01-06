using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[Authorize]
public class BranchesController : BaseApiController
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<BranchesController> _logger;

    public BranchesController(ApplicationDbContext db, ILogger<BranchesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get all branches for the current tenant with optional pagination
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<BranchDto>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = "Name",
        [FromQuery] string sortOrder = "asc",
        CancellationToken ct = default)
    {
        try
        {
            var tenantId = GetTenantId();
            
            var query = _db.Branches
                .Include(b => b.Manager)
                .Where(b => b.TenantId == tenantId && !b.IsDeleted)
                .AsQueryable();

            // Search filter
            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(b => 
                    b.Name.ToLower().Contains(search) || 
                    b.Location.ToLower().Contains(search) ||
                    b.Code.ToLower().Contains(search));
            }

            // Sorting
            query = sortBy?.ToLower() switch
            {
                "code" => sortOrder == "desc" ? query.OrderByDescending(b => b.Code) : query.OrderBy(b => b.Code),
                "location" => sortOrder == "desc" ? query.OrderByDescending(b => b.Location) : query.OrderBy(b => b.Location),
                "createdat" => sortOrder == "desc" ? query.OrderByDescending(b => b.CreatedAt) : query.OrderBy(b => b.CreatedAt),
                _ => sortOrder == "desc" ? query.OrderByDescending(b => b.Name) : query.OrderBy(b => b.Name)
            };

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var branches = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(b => new BranchDto(
                    b.Id, b.Name, b.Code, b.Location, b.IsOfflineEnabled,
                    b.LicenseCount, b.ManagerId, b.Manager != null ? b.Manager.Name : null
                ))
                .ToListAsync();

            var result = new PaginatedResponse<BranchDto>
            {
                Items = branches,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize,
                TotalPages = totalPages
            };

            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting branches");
            return BadRequestResponse<PaginatedResponse<BranchDto>>("Failed to retrieve branches");
        }
    }

    /// <summary>
    /// Get a specific branch by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<BranchDto>>> GetById(Guid id, CancellationToken ct)
    {
        try
        {
            var tenantId = GetTenantId();
            var branch = await _db.Branches
                .Include(b => b.Manager)
                .Where(b => b.Id == id && b.TenantId == tenantId && !b.IsDeleted)
                .Select(b => new BranchDto(
                    b.Id, b.Name, b.Code, b.Location, b.IsOfflineEnabled,
                    b.LicenseCount, b.ManagerId, b.Manager != null ? b.Manager.Name : null
                ))
                .FirstOrDefaultAsync();

            if (branch == null)
                return NotFoundResponse<BranchDto>("Branch not found");

            return Success(branch);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting branch {BranchId}", id);
            return BadRequestResponse<BranchDto>("Failed to retrieve branch");
        }
    }

    /// <summary>
    /// Create a new branch
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<BranchDto>>> Create([FromBody] CreateBranchRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();

            // Check for duplicate code
            var existingCode = await _db.Branches
                .AnyAsync(b => b.TenantId == tenantId && b.Code == request.Code && !b.IsDeleted);
            
            if (existingCode)
            {
                return BadRequestResponse<BranchDto>("A branch with this code already exists");
            }

            var branch = new Branch
            {
                TenantId = tenantId,
                Name = request.Name,
                Code = request.Code,
                Location = request.Location,
                IsOfflineEnabled = request.IsOfflineEnabled,
                LicenseCount = request.LicenseCount,
                ManagerId = request.ManagerId,
                CreatedBy = userId.ToString()
            };

            _db.Branches.Add(branch);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Branch {BranchId} created by user {UserId}", branch.Id, userId);

            var dto = new BranchDto(branch.Id, branch.Name, branch.Code, branch.Location,
                branch.IsOfflineEnabled, branch.LicenseCount, branch.ManagerId, null);

            return Created(dto, nameof(GetById), new { id = branch.Id });
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
    public async Task<ActionResult<ApiResponse<BranchDto>>> Update(Guid id, [FromBody] UpdateBranchRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            
            var branch = await _db.Branches
                .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId && !b.IsDeleted);

            if (branch == null)
                return NotFoundResponse<BranchDto>("Branch not found");

            // Check for duplicate code if changing
            if (request.Code != null && request.Code != branch.Code)
            {
                var existingCode = await _db.Branches
                    .AnyAsync(b => b.TenantId == tenantId && b.Code == request.Code && b.Id != id && !b.IsDeleted);
                
                if (existingCode)
                {
                    return BadRequestResponse<BranchDto>("A branch with this code already exists");
                }
            }

            if (request.Name != null) branch.Name = request.Name;
            if (request.Code != null) branch.Code = request.Code;
            if (request.Location != null) branch.Location = request.Location;
            if (request.IsOfflineEnabled.HasValue) branch.IsOfflineEnabled = request.IsOfflineEnabled.Value;
            if (request.LicenseCount.HasValue) branch.LicenseCount = request.LicenseCount.Value;
            if (request.ManagerId.HasValue) branch.ManagerId = request.ManagerId;

            branch.ModifiedAt = DateTime.UtcNow;
            branch.ModifiedBy = userId.ToString();

            await _db.SaveChangesAsync();

            _logger.LogInformation("Branch {BranchId} updated by user {UserId}", id, userId);

            var dto = new BranchDto(branch.Id, branch.Name, branch.Code, branch.Location,
                branch.IsOfflineEnabled, branch.LicenseCount, branch.ManagerId, null);

            return Success(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating branch {BranchId}", id);
            return BadRequestResponse<BranchDto>("Failed to update branch");
        }
    }

    /// <summary>
    /// Delete a branch (soft delete)
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            
            var branch = await _db.Branches
                .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId && !b.IsDeleted);

            if (branch == null)
                return NotFoundResponse<bool>("Branch not found");

            // Check if branch has active users or products
            var hasActiveUsers = await _db.Users
                .AnyAsync(u => u.BranchId == id && !u.IsDeleted);
            
            if (hasActiveUsers)
            {
                return BadRequestResponse<bool>("Cannot delete branch with active users. Reassign users first.");
            }

            branch.IsDeleted = true;
            branch.ModifiedAt = DateTime.UtcNow;
            branch.ModifiedBy = userId.ToString();

            await _db.SaveChangesAsync();

            _logger.LogInformation("Branch {BranchId} deleted by user {UserId}", id, userId);

            return Success(true, "Branch deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting branch {BranchId}", id);
            return BadRequestResponse<bool>("Failed to delete branch");
        }
    }

    /// <summary>
    /// Bulk create branches
    /// </summary>
    [HttpPost("bulk")]
    public async Task<ActionResult<ApiResponse<List<BranchDto>>>> BulkCreate([FromBody] BulkCreateBranchesRequest request)
    {
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            var createdBranches = new List<BranchDto>();

            foreach (var branchRequest in request.Items)
            {
                var branch = new Branch
                {
                    TenantId = tenantId,
                    Name = branchRequest.Name,
                    Code = branchRequest.Code,
                    Location = branchRequest.Location,
                    IsOfflineEnabled = branchRequest.IsOfflineEnabled,
                    LicenseCount = branchRequest.LicenseCount,
                    CreatedBy = userId.ToString()
                };

                _db.Branches.Add(branch);
                createdBranches.Add(new BranchDto(
                    branch.Id, branch.Name, branch.Code, branch.Location,
                    branch.IsOfflineEnabled, branch.LicenseCount, null, null
                ));
            }

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("{Count} branches bulk created by user {UserId}", createdBranches.Count, userId);

            return Success(createdBranches);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error bulk creating branches");
            return BadRequestResponse<List<BranchDto>>("Failed to create branches");
        }
    }
}

// DTOs
public record BranchDto(
    Guid Id,
    string Name,
    string Code,
    string Location,
    bool IsOfflineEnabled,
    int LicenseCount,
    Guid? ManagerId,
    string? ManagerName
);

public class CreateBranchRequest
{
    public required string Name { get; set; }
    public required string Code { get; set; }
    public required string Location { get; set; }
    public bool IsOfflineEnabled { get; set; } = true;
    public int LicenseCount { get; set; } = 1;
    public Guid? ManagerId { get; set; }
}

public class UpdateBranchRequest
{
    public string? Name { get; set; }
    public string? Code { get; set; }
    public string? Location { get; set; }
    public bool? IsOfflineEnabled { get; set; }
    public int? LicenseCount { get; set; }
    public Guid? ManagerId { get; set; }
}

public class BulkCreateBranchesRequest
{
    public required List<CreateBranchRequest> Items { get; set; }
}

public class PaginatedResponse<T>
{
    public required List<T> Items { get; set; }
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    public bool HasNextPage => PageNumber < TotalPages;
    public bool HasPreviousPage => PageNumber > 1;
}
