using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BranchesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public BranchesController(ApplicationDbContext db)
    {
        _db = db;
    }

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")?.Value ?? throw new UnauthorizedAccessException());

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IEnumerable<BranchDto>>>> GetAll()
    {
        var tenantId = GetTenantId();
        var branches = await _db.Branches
            .Include(b => b.Manager)
            .Where(b => b.TenantId == tenantId)
            .Select(b => new BranchDto(
                b.Id, b.Name, b.Code, b.Location, b.IsOfflineEnabled, 
                b.LicenseCount, b.ManagerId, b.Manager != null ? b.Manager.Name : null
            ))
            .ToListAsync();

        return Ok(new ApiResponse<IEnumerable<BranchDto>>(true, branches));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<BranchDto>>> GetById(Guid id)
    {
        var tenantId = GetTenantId();
        var branch = await _db.Branches
            .Include(b => b.Manager)
            .Where(b => b.Id == id && b.TenantId == tenantId)
            .Select(b => new BranchDto(
                b.Id, b.Name, b.Code, b.Location, b.IsOfflineEnabled, 
                b.LicenseCount, b.ManagerId, b.Manager != null ? b.Manager.Name : null
            ))
            .FirstOrDefaultAsync();

        if (branch == null)
            return NotFound(new ApiResponse<BranchDto>(false, null, "Branch not found"));

        return Ok(new ApiResponse<BranchDto>(true, branch));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<BranchDto>>> Create([FromBody] CreateBranchRequest request)
    {
        var tenantId = GetTenantId();
        
        var branch = new Branch
        {
            TenantId = tenantId,
            Name = request.Name,
            Code = request.Code,
            Location = request.Location,
            IsOfflineEnabled = request.IsOfflineEnabled,
            LicenseCount = request.LicenseCount,
            ManagerId = request.ManagerId,
            CreatedBy = User.FindFirst("sub")?.Value
        };

        _db.Branches.Add(branch);
        await _db.SaveChangesAsync();

        var dto = new BranchDto(branch.Id, branch.Name, branch.Code, branch.Location, 
            branch.IsOfflineEnabled, branch.LicenseCount, branch.ManagerId, null);

        return CreatedAtAction(nameof(GetById), new { id = branch.Id }, new ApiResponse<BranchDto>(true, dto));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<BranchDto>>> Update(Guid id, [FromBody] UpdateBranchRequest request)
    {
        var tenantId = GetTenantId();
        var branch = await _db.Branches.FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId);

        if (branch == null)
            return NotFound(new ApiResponse<BranchDto>(false, null, "Branch not found"));

        if (request.Name != null) branch.Name = request.Name;
        if (request.Code != null) branch.Code = request.Code;
        if (request.Location != null) branch.Location = request.Location;
        if (request.IsOfflineEnabled.HasValue) branch.IsOfflineEnabled = request.IsOfflineEnabled.Value;
        if (request.LicenseCount.HasValue) branch.LicenseCount = request.LicenseCount.Value;
        if (request.ManagerId.HasValue) branch.ManagerId = request.ManagerId;

        branch.ModifiedAt = DateTime.UtcNow;
        branch.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        var dto = new BranchDto(branch.Id, branch.Name, branch.Code, branch.Location, 
            branch.IsOfflineEnabled, branch.LicenseCount, branch.ManagerId, null);

        return Ok(new ApiResponse<BranchDto>(true, dto));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id)
    {
        var tenantId = GetTenantId();
        var branch = await _db.Branches.FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId);

        if (branch == null)
            return NotFound(new ApiResponse<bool>(false, false, "Branch not found"));

        branch.IsDeleted = true;
        branch.ModifiedAt = DateTime.UtcNow;
        branch.ModifiedBy = User.FindFirst("sub")?.Value;

        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<bool>(true, true, "Branch deleted"));
    }
}

