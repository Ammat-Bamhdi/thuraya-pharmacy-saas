using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Domain.Entities;
using ThurayyaPharmacy.Domain.Enums;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Controllers;

/// <summary>
/// User management endpoints
/// </summary>
[Authorize]
public class UsersController : BaseApiController
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<UsersController> _logger;

    public UsersController(ApplicationDbContext db, ILogger<UsersController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get all users for the current tenant
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetAll()
    {
        try
        {
            var tenantId = GetTenantId();

            var users = await _db.Users
                .Where(u => u.TenantId == tenantId && !u.IsDeleted)
                .Include(u => u.Branch)
                .OrderBy(u => u.Name)
                .Select(u => new UserDto(
                    u.Id,
                    u.Name,
                    u.Email,
                    u.Role,
                    u.BranchId,
                    u.Branch != null ? u.Branch.Name : null,
                    u.Status,
                    u.Avatar
                ))
                .ToListAsync();

            return Success(users);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting users");
            return BadRequestResponse<List<UserDto>>("Failed to retrieve users");
        }
    }

    /// <summary>
    /// Get a user by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetById(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();

            var user = await _db.Users
                .Where(u => u.Id == id && u.TenantId == tenantId && !u.IsDeleted)
                .Include(u => u.Branch)
                .Select(u => new UserDto(
                    u.Id,
                    u.Name,
                    u.Email,
                    u.Role,
                    u.BranchId,
                    u.Branch != null ? u.Branch.Name : null,
                    u.Status,
                    u.Avatar
                ))
                .FirstOrDefaultAsync();

            if (user == null)
                return NotFoundResponse<UserDto>("User not found");

            return Success(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user {UserId}", id);
            return BadRequestResponse<UserDto>("Failed to retrieve user");
        }
    }

    /// <summary>
    /// Invite a new user to the tenant
    /// </summary>
    [HttpPost("invite")]
    public async Task<ActionResult<ApiResponse<UserDto>>> Invite([FromBody] InviteUserRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var currentUserId = GetUserId();

            // Check if email already exists in this tenant
            var existingUser = await _db.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower() && u.TenantId == tenantId);

            if (existingUser != null)
            {
                if (existingUser.IsDeleted)
                {
                    // Reactivate deleted user
                    existingUser.IsDeleted = false;
                    existingUser.Name = request.Name;
                    existingUser.Role = ParseRole(request.Role);
                    existingUser.BranchId = request.BranchId;
                    existingUser.Status = UserStatus.Invited;
                    existingUser.ModifiedAt = DateTime.UtcNow;
                    existingUser.ModifiedBy = currentUserId.ToString();

                    await _db.SaveChangesAsync();

                    var reactivatedDto = new UserDto(
                        existingUser.Id,
                        existingUser.Name,
                        existingUser.Email,
                        existingUser.Role,
                        existingUser.BranchId,
                        null,
                        existingUser.Status,
                        existingUser.Avatar
                    );

                    _logger.LogInformation("Reactivated user {Email} for tenant {TenantId}", request.Email, tenantId);
                    return Success(reactivatedDto, "User reactivated successfully");
                }

                return BadRequestResponse<UserDto>("A user with this email already exists");
            }

            // Validate branch belongs to tenant if provided
            if (request.BranchId.HasValue)
            {
                var branchExists = await _db.Branches
                    .AnyAsync(b => b.Id == request.BranchId.Value && b.TenantId == tenantId && !b.IsDeleted);

                if (!branchExists)
                    return BadRequestResponse<UserDto>("Invalid branch ID");
            }

            // Create new invited user
            var user = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = request.Email.ToLower().Trim(),
                Name = request.Name.Trim(),
                Role = ParseRole(request.Role),
                BranchId = request.BranchId,
                Status = UserStatus.Invited,
                PasswordHash = "", // No password for invited users - they'll set it on first login
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUserId.ToString()
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            var dto = new UserDto(
                user.Id,
                user.Name,
                user.Email,
                user.Role,
                user.BranchId,
                null,
                user.Status,
                user.Avatar
            );

            _logger.LogInformation("Invited user {Email} to tenant {TenantId}", request.Email, tenantId);
            return Created(dto, nameof(GetById), new { id = user.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error inviting user {Email}", request.Email);
            return BadRequestResponse<UserDto>("Failed to invite user");
        }
    }

    /// <summary>
    /// Update a user
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<UserDto>>> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var currentUserId = GetUserId();

            var user = await _db.Users
                .Include(u => u.Branch)
                .FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId && !u.IsDeleted);

            if (user == null)
                return NotFoundResponse<UserDto>("User not found");

            // Update fields if provided
            if (!string.IsNullOrWhiteSpace(request.Name))
                user.Name = request.Name.Trim();

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                var emailLower = request.Email.ToLower().Trim();
                // Check if email is taken by another user
                var emailTaken = await _db.Users
                    .AnyAsync(u => u.Id != id && u.Email.ToLower() == emailLower && u.TenantId == tenantId && !u.IsDeleted);

                if (emailTaken)
                    return BadRequestResponse<UserDto>("Email is already in use");

                user.Email = emailLower;
            }

            if (request.Role.HasValue)
                user.Role = request.Role.Value;

            if (request.BranchId.HasValue)
            {
                // Validate branch
                var branchExists = await _db.Branches
                    .AnyAsync(b => b.Id == request.BranchId.Value && b.TenantId == tenantId && !b.IsDeleted);

                if (!branchExists)
                    return BadRequestResponse<UserDto>("Invalid branch ID");

                user.BranchId = request.BranchId.Value;
            }

            if (request.Status.HasValue)
                user.Status = request.Status.Value;

            user.ModifiedAt = DateTime.UtcNow;
            user.ModifiedBy = currentUserId.ToString();

            await _db.SaveChangesAsync();

            var dto = new UserDto(
                user.Id,
                user.Name,
                user.Email,
                user.Role,
                user.BranchId,
                user.Branch?.Name,
                user.Status,
                user.Avatar
            );

            return Success(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user {UserId}", id);
            return BadRequestResponse<UserDto>("Failed to update user");
        }
    }

    /// <summary>
    /// Delete (soft) a user
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var currentUserId = GetUserId();

            // Prevent self-deletion
            if (id == currentUserId)
                return BadRequestResponse<bool>("You cannot delete your own account");

            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId && !u.IsDeleted);

            if (user == null)
                return NotFoundResponse<bool>("User not found");

            user.IsDeleted = true;
            user.ModifiedAt = DateTime.UtcNow;
            user.ModifiedBy = currentUserId.ToString();

            await _db.SaveChangesAsync();

            _logger.LogInformation("Deleted user {UserId} from tenant {TenantId}", id, tenantId);
            return Success(true, "User deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user {UserId}", id);
            return BadRequestResponse<bool>("Failed to delete user");
        }
    }

    private static UserRole ParseRole(string role)
    {
        return role?.ToLower() switch
        {
            "superadmin" or "super_admin" => UserRole.SuperAdmin,
            "branchadmin" or "branch_admin" => UserRole.BranchAdmin,
            "sectionadmin" or "section_admin" => UserRole.SectionAdmin,
            _ => UserRole.SectionAdmin
        };
    }
}
