using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Application.Mappings;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.Infrastructure.Services;

/// <summary>
/// Production-grade branch management service.
/// Handles CRUD operations, bulk operations, and setup status tracking.
/// 
/// Architecture Notes:
/// - All queries respect multi-tenant isolation via global query filters
/// - Bulk operations use transactions for atomicity
/// - Batch processing prevents memory issues with large datasets
/// - Comprehensive logging for audit trails
/// </summary>
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

    // =========================================================================
    // SETUP STATUS OPERATIONS
    // =========================================================================

    /// <summary>
    /// Gets the current setup status for the tenant.
    /// 
    /// Business Rules:
    /// - Setup is complete when all branches have managers OR no branches exist
    /// - Requires attention threshold: >10% branches without managers
    /// - Percentage is 100 if no branches exist (nothing to configure)
    /// </summary>
    public async Task<SetupStatusDto> GetSetupStatusAsync(CancellationToken ct)
    {
        // Use AsNoTracking to ensure we get fresh data from database, not cached entities
        var totalBranches = await _db.Branches.AsNoTracking().CountAsync(ct);
        var branchesWithManagers = await _db.Branches.AsNoTracking().CountAsync(b => b.ManagerId != null, ct);
        var branchesWithoutManagers = totalBranches - branchesWithManagers;
        
        // Calculate completion percentage (100% if no branches)
        var completionPercentage = totalBranches == 0 
            ? 100 
            : (int)Math.Round((double)branchesWithManagers / totalBranches * 100);
        
        // Setup is complete if all branches have managers
        var isSetupComplete = branchesWithoutManagers == 0;
        
        // Requires attention if >10% branches lack managers
        var requiresAttention = totalBranches > 0 && 
            ((double)branchesWithoutManagers / totalBranches) > 0.10;

        _logger.LogDebug(
            "Setup status: {Total} branches, {WithManagers} with managers, {WithoutManagers} without",
            totalBranches, branchesWithManagers, branchesWithoutManagers);

        return new SetupStatusDto(
            totalBranches,
            branchesWithManagers,
            branchesWithoutManagers,
            completionPercentage,
            isSetupComplete,
            requiresAttention
        );
    }

    /// <summary>
    /// Gets branches without managers with pagination.
    /// 
    /// Use Cases:
    /// - Dashboard setup card showing pending assignments
    /// - Manager assignment page list view
    /// - Bulk selection for manager assignment
    /// </summary>
    public async Task<PaginatedResponse<BranchDto>> GetBranchesWithoutManagerAsync(
        int page,
        int pageSize,
        string? search,
        CancellationToken ct)
    {
        // Use AsNoTracking to ensure we get fresh data from database
        var query = _db.Branches
            .AsNoTracking()
            .Include(b => b.Manager)
            .Where(b => b.ManagerId == null);

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(b => 
                b.Name.ToLower().Contains(searchLower) || 
                b.Code.ToLower().Contains(searchLower) ||
                b.Location.ToLower().Contains(searchLower));
        }

        // Order by name for consistent results
        query = query.OrderBy(b => b.Name);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(b => b.ToDto())
            .ToListAsync(ct);

        return PaginatedResponse<BranchDto>.Create(items, totalCount, page, pageSize);
    }

    /// <summary>
    /// Gets users who can be assigned as branch managers.
    /// 
    /// Business Rules:
    /// - Only SuperAdmin and BranchAdmin roles can be managers
    /// - Returns count of branches already assigned to each user
    /// - Ordered by name for consistent dropdown experience
    /// </summary>
    public async Task<List<ManagerOptionDto>> GetAvailableManagersAsync(CancellationToken ct)
    {
        // Get users with manager-eligible roles
        var eligibleRoles = new[] { UserRole.SuperAdmin, UserRole.BranchAdmin };
        
        var managers = await _db.Users
            .Where(u => eligibleRoles.Contains(u.Role) && u.Status != UserStatus.Suspended)
            .Select(u => new
            {
                u.Id,
                u.Name,
                u.Email,
                Role = u.Role.ToString(),
                // Count branches this user manages
                AssignedBranchCount = _db.Branches.Count(b => b.ManagerId == u.Id)
            })
            .OrderBy(u => u.Name)
            .ToListAsync(ct);

        return managers.Select(m => new ManagerOptionDto(
            m.Id,
            m.Name,
            m.Email,
            m.Role,
            m.AssignedBranchCount
        )).ToList();
    }

    /// <summary>
    /// Bulk assigns a manager to multiple branches.
    /// 
    /// Production Considerations:
    /// - Validates manager exists and has appropriate role
    /// - Uses transaction for atomicity
    /// - Batch updates for performance
    /// - Detailed error reporting for partial failures
    /// - Audit logging for compliance
    /// </summary>
    public async Task<BulkAssignManagerResponse> BulkAssignManagerAsync(
        BulkAssignManagerRequest request, 
        CancellationToken ct)
    {
        var errors = new List<string>();
        var successCount = 0;

        // Validate manager exists and has appropriate role
        var manager = await _db.Users.FindAsync(new object[] { request.ManagerId }, ct);
        if (manager == null)
        {
            return new BulkAssignManagerResponse(0, request.BranchIds.Count, 
                new List<string> { "Manager not found" });
        }

        var eligibleRoles = new[] { UserRole.SuperAdmin, UserRole.BranchAdmin };
        if (!eligibleRoles.Contains(manager.Role))
        {
            return new BulkAssignManagerResponse(0, request.BranchIds.Count,
                new List<string> { $"User '{manager.Name}' is not eligible to be a branch manager. Required role: SuperAdmin or BranchAdmin" });
        }

        _logger.LogInformation(
            "Starting bulk manager assignment: {BranchCount} branches to manager {ManagerName} ({ManagerId})",
            request.BranchIds.Count, manager.Name, manager.Id);

        // Use execution strategy for SQL Server retry compatibility
        var strategy = _db.Database.CreateExecutionStrategy();
        
        return await strategy.ExecuteAsync(async () =>
        {
            using var transaction = await _db.Database.BeginTransactionAsync(ct);
            
            try
            {
                // Use ExecuteUpdateAsync for reliable, set-based update
                _logger.LogInformation(
                    "Starting ExecuteUpdate for {RequestedCount} branches -> manager {ManagerId}",
                    request.BranchIds.Count, request.ManagerId);

                var updatedCount = await _db.Branches
                    .Where(b => request.BranchIds.Contains(b.Id))
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(b => b.ManagerId, _ => request.ManagerId)
                        .SetProperty(b => b.ModifiedAt, _ => DateTime.UtcNow), ct);

                await transaction.CommitAsync(ct);
                _logger.LogInformation("Transaction committed. Rows affected: {UpdatedCount}", updatedCount);

                // Clear change tracker to ensure subsequent queries get fresh data from database
                _db.ChangeTracker.Clear();

                // Verify the save by querying the database
                var verifyCount = await _db.Branches
                    .AsNoTracking()
                    .CountAsync(b => request.BranchIds.Contains(b.Id) && b.ManagerId == request.ManagerId, ct);

                var notUpdated = request.BranchIds.Count - verifyCount;
                if (verifyCount == 0)
                {
                    _logger.LogWarning("No branches were updated. Requested IDs: {Ids}", string.Join(", ", request.BranchIds));
                    errors.Add("No branches were updated. Please verify branch IDs and tenant.");
                }
                else if (notUpdated > 0)
                {
                    _logger.LogWarning("{NotUpdated} branches were not updated. Requested: {Total}, Updated: {Updated}",
                        notUpdated, request.BranchIds.Count, verifyCount);
                    errors.Add($"{notUpdated} branch(es) were not updated.");
                }

                successCount = verifyCount;

                _logger.LogInformation(
                    "Bulk manager assignment completed: {Success}/{Total} branches assigned to {ManagerName}",
                    successCount, request.BranchIds.Count, manager.Name);

                return new BulkAssignManagerResponse(
                    successCount,
                    request.BranchIds.Count - successCount,
                    errors
                );
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                _logger.LogError(ex, "Bulk manager assignment failed");
                throw;
            }
        });
    }
}