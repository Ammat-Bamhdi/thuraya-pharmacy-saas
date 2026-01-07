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

    /// <summary>
    /// Bulk create branches with production-grade optimizations:
    /// - Transaction wrapping for atomicity
    /// - Batch processing (100 per batch)
    /// - Single query for duplicate detection
    /// - Input validation
    /// - Logging for audit trail
    /// </summary>
    public async Task<List<BranchDto>> BulkCreateAsync(IEnumerable<CreateBranchRequest> requests, CancellationToken ct)
    {
        var requestList = requests.ToList();
        
        // Validate input
        if (requestList.Count == 0) 
            return new List<BranchDto>();
        
        // Production limit: prevent abuse (configurable via appsettings in real scenario)
        const int maxBulkSize = 5000;
        if (requestList.Count > maxBulkSize)
        {
            throw new ArgumentException($"Bulk operation limited to {maxBulkSize} items. Received: {requestList.Count}");
        }

        _logger.LogInformation("Starting bulk branch creation: {Count} branches", requestList.Count);
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        const int batchSize = 100;
        var allCreatedBranches = new List<Branch>();

        // Get all existing codes in ONE query instead of N queries
        var newCodes = requestList.Select(r => r.Code).Distinct().ToList();
        var existingCodes = await _db.Branches
            .IgnoreQueryFilters() // Check across all tenants to prevent code collision
            .Where(b => newCodes.Contains(b.Code))
            .Select(b => b.Code)
            .ToListAsync(ct);
        var existingCodesSet = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);

        // Use execution strategy for SQL Server retrying + transaction for atomicity
        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var transaction = await _db.Database.BeginTransactionAsync(ct);
            try
            {
                // Process in batches
                for (int i = 0; i < requestList.Count; i += batchSize)
                {
                    ct.ThrowIfCancellationRequested();
                    
                    var batch = requestList.Skip(i).Take(batchSize);
                    var branches = new List<Branch>();
                    
                    foreach (var request in batch)
                    {
                        // Validate required fields
                        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Code))
                        {
                            _logger.LogWarning("Skipping invalid branch: Name or Code is empty");
                            continue;
                        }
                        
                        // Skip if code already exists
                        if (existingCodesSet.Contains(request.Code))
                        {
                            _logger.LogDebug("Skipping duplicate branch code: {Code}", request.Code);
                            continue;
                        }
                        
                        // Add to set to prevent duplicates within this bulk operation
                        existingCodesSet.Add(request.Code);

                        branches.Add(new Branch
                        {
                            Name = request.Name.Trim(),
                            Code = request.Code.Trim().ToUpperInvariant(),
                            Location = request.Location?.Trim() ?? "",
                            IsOfflineEnabled = request.IsOfflineEnabled,
                            LicenseCount = Math.Max(1, request.LicenseCount),
                            ManagerId = request.ManagerId,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    if (branches.Count > 0)
                    {
                        _db.Branches.AddRange(branches);
                        await _db.SaveChangesAsync(ct);
                        allCreatedBranches.AddRange(branches);
                    }
                }

                await transaction.CommitAsync(ct);
                
                stopwatch.Stop();
                _logger.LogInformation(
                    "Bulk branch creation completed: {Created}/{Total} branches in {ElapsedMs}ms",
                    allCreatedBranches.Count, requestList.Count, stopwatch.ElapsedMilliseconds);

                return allCreatedBranches.Select(b => b.ToDto()).ToList();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                _logger.LogError(ex, "Bulk branch creation failed. Rolling back {Count} branches", allCreatedBranches.Count);
                throw;
            }
        });
    }
}