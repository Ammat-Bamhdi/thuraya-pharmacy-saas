using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Application.Mappings;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.Infrastructure.Services;

public class BranchService : IBranchService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<BranchService> _logger;

    public BranchService(ApplicationDbContext db, ILogger<BranchService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<PaginatedResponse<BranchDto>> GetAllAsync(
        int page,
        int pageSize,
        string? search,
        string? sortBy,
        string sortOrder,
        CancellationToken ct)
    {
        var query = _db.Branches
            .Include(b => b.Manager)
            .AsQueryable();

        if (!string.IsNullOrEmpty(search))
        {
            search = search.ToLower();
            query = query.Where(b => b.Name.ToLower().Contains(search) || b.Code.ToLower().Contains(search));
        }

        query = sortOrder.ToLower() == "desc"
            ? query.OrderByDescending(b => EF.Property<object>(b, sortBy ?? "Name"))
            : query.OrderBy(b => EF.Property<object>(b, sortBy ?? "Name"));

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(b => b.ToDto())
            .ToListAsync(ct);

        return PaginatedResponse<BranchDto>.Create(items, totalCount, page, pageSize);
    }

    public async Task<BranchDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var branch = await _db.Branches
            .Include(b => b.Manager)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (branch == null) throw new KeyNotFoundException("Branch not found");

        return branch.ToDto();
    }

    public async Task<BranchDto> CreateAsync(CreateBranchRequest request, CancellationToken ct)
    {
        if (await _db.Branches.AnyAsync(b => b.Code == request.Code, ct))
            throw new ArgumentException("A branch with this code already exists");

        var branch = new Branch
        {
            Name = request.Name,
            Code = request.Code,
            Location = request.Location,
            IsOfflineEnabled = request.IsOfflineEnabled,
            LicenseCount = request.LicenseCount,
            ManagerId = request.ManagerId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Branches.Add(branch);
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(branch.Id, ct);
    }

    public async Task<BranchDto> UpdateAsync(Guid id, UpdateBranchRequest request, CancellationToken ct)
    {
        var branch = await _db.Branches.FindAsync(new object[] { id }, ct);
        if (branch == null) throw new KeyNotFoundException("Branch not found");

        if (request.Code != null && request.Code != branch.Code)
        {
            if (await _db.Branches.AnyAsync(b => b.Code == request.Code && b.Id != id, ct))
                throw new ArgumentException("A branch with this code already exists");
            branch.Code = request.Code;
        }

        if (request.Name != null) branch.Name = request.Name;
        if (request.Location != null) branch.Location = request.Location;
        if (request.IsOfflineEnabled.HasValue) branch.IsOfflineEnabled = request.IsOfflineEnabled.Value;
        if (request.LicenseCount.HasValue) branch.LicenseCount = request.LicenseCount.Value;
        if (request.ManagerId.HasValue) branch.ManagerId = request.ManagerId;

        branch.ModifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var branch = await _db.Branches.FindAsync(new object[] { id }, ct);
        if (branch == null) return false;

        branch.IsDeleted = true;
        branch.ModifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return true;
    }

    public async Task<List<BranchDto>> BulkCreateAsync(IEnumerable<CreateBranchRequest> requests, CancellationToken ct)
    {
        var branches = new List<Branch>();
        foreach (var request in requests)
        {
            if (await _db.Branches.AnyAsync(b => b.Code == request.Code, ct))
                continue; // Skip duplicates for bulk

            branches.Add(new Branch
            {
                Name = request.Name,
                Code = request.Code,
                Location = request.Location,
                IsOfflineEnabled = request.IsOfflineEnabled,
                LicenseCount = request.LicenseCount,
                ManagerId = request.ManagerId,
                CreatedAt = DateTime.UtcNow
            });
        }

        _db.Branches.AddRange(branches);
        await _db.SaveChangesAsync(ct);

        return branches.Select(b => b.ToDto()).ToList();
    }
}