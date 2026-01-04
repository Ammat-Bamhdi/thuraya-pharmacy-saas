using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ThurayyaPharmacy.API.Controllers;

/// <summary>
/// Base controller providing common functionality for all API controllers
/// </summary>
[ApiController]
[Route("api/[controller]")]
public abstract class BaseApiController : ControllerBase
{
    /// <summary>
    /// Gets the current user's ID from JWT claims
    /// </summary>
    protected Guid GetUserId()
    {
        var userClaim = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
            ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userClaim) || !Guid.TryParse(userClaim, out var userId))
        {
            throw new UnauthorizedAccessException("User ID not found or invalid in token");
        }
        
        return userId;
    }

    /// <summary>
    /// Gets the current tenant ID from JWT claims
    /// </summary>
    protected Guid GetTenantId()
    {
        var tenantClaim = User.FindFirst("tenantId")?.Value;
        
        if (string.IsNullOrEmpty(tenantClaim) || !Guid.TryParse(tenantClaim, out var tenantId))
        {
            throw new UnauthorizedAccessException("Tenant ID not found or invalid in token");
        }
        
        return tenantId;
    }

    /// <summary>
    /// Gets the current user's branch ID from JWT claims (optional)
    /// </summary>
    protected Guid? GetBranchId()
    {
        var branchClaim = User.FindFirst("branchId")?.Value;
        
        if (string.IsNullOrEmpty(branchClaim) || !Guid.TryParse(branchClaim, out var branchId))
        {
            return null;
        }
        
        return branchId;
    }

    /// <summary>
    /// Gets the current user's role from JWT claims
    /// </summary>
    protected string GetUserRole()
    {
        return User.FindFirst(ClaimTypes.Role)?.Value 
            ?? User.FindFirst("role")?.Value 
            ?? "User";
    }

    /// <summary>
    /// Checks if the current user is a super admin
    /// </summary>
    protected bool IsSuperAdmin()
    {
        var role = GetUserRole();
        return role.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Checks if the current user is a branch admin or higher
    /// </summary>
    protected bool IsBranchAdminOrHigher()
    {
        var role = GetUserRole();
        return role.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) 
            || role.Equals("BranchAdmin", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Creates a success response
    /// </summary>
    protected ActionResult<Application.DTOs.ApiResponse<T>> Success<T>(T data, string? message = null)
    {
        return Ok(new Application.DTOs.ApiResponse<T>(true, data, message));
    }

    /// <summary>
    /// Creates a created response (201)
    /// </summary>
    protected ActionResult<Application.DTOs.ApiResponse<T>> Created<T>(T data, string actionName, object routeValues)
    {
        return CreatedAtAction(actionName, routeValues, new Application.DTOs.ApiResponse<T>(true, data));
    }

    /// <summary>
    /// Creates a not found response
    /// </summary>
    protected ActionResult<Application.DTOs.ApiResponse<T>> NotFoundResponse<T>(string message = "Resource not found")
    {
        return NotFound(new Application.DTOs.ApiResponse<T>(false, default, message));
    }

    /// <summary>
    /// Creates a bad request response
    /// </summary>
    protected ActionResult<Application.DTOs.ApiResponse<T>> BadRequestResponse<T>(string message)
    {
        return BadRequest(new Application.DTOs.ApiResponse<T>(false, default, message));
    }

    /// <summary>
    /// Creates a forbidden response
    /// </summary>
    protected ActionResult<Application.DTOs.ApiResponse<T>> ForbiddenResponse<T>(string message = "You don't have permission to perform this action")
    {
        return StatusCode(403, new Application.DTOs.ApiResponse<T>(false, default, message));
    }
}

