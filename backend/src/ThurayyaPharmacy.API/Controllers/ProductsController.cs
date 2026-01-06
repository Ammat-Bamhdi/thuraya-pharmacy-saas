using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;

namespace ThurayyaPharmacy.API.Controllers;

/// <summary>
/// Controller for inventory and product management
/// </summary>
[Authorize]
public class ProductsController : BaseApiController
{
    private readonly IProductService _productService;
    private readonly ILogger<ProductsController> _logger;

    public ProductsController(IProductService productService, ILogger<ProductsController> logger)
    {
        _productService = productService;
        _logger = logger;
    }

    /// <summary>
    /// Get all products with pagination, filtering and sorting
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ThurayyaPharmacy.Application.DTOs.ApiResponse<ThurayyaPharmacy.Application.DTOs.PaginatedResponse<ProductDto>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] bool? lowStock = null,
        [FromQuery] bool? expiringSoon = null,
        [FromQuery] string? sortBy = "Name",
        [FromQuery] string sortOrder = "asc",
        CancellationToken ct = default)
    {
        try
        {
            var result = await _productService.GetAllAsync(page, pageSize, branchId, search, category, supplierId, lowStock, expiringSoon, sortBy, sortOrder, ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting products");
            return BadRequestResponse<ThurayyaPharmacy.Application.DTOs.PaginatedResponse<ProductDto>>("Failed to retrieve products");
        }
    }

    /// <summary>
    /// Get product by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProductDto>>> GetById(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _productService.GetByIdAsync(id, ct);
            return Success(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFoundResponse<ProductDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product {Id}", id);
            return BadRequestResponse<ProductDto>("Failed to retrieve product");
        }
    }

    /// <summary>
    /// Get products with low stock
    /// </summary>
    [HttpGet("low-stock")]
    public async Task<ActionResult<ApiResponse<List<ProductDto>>>> GetLowStock([FromQuery] Guid? branchId, CancellationToken ct)
    {
        try
        {
            var result = await _productService.GetLowStockAsync(branchId, ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting low stock products");
            return BadRequestResponse<List<ProductDto>>("Failed to retrieve low stock products");
        }
    }

    /// <summary>
    /// Get expiring products
    /// </summary>
    [HttpGet("expiring")]
    public async Task<ActionResult<ApiResponse<List<ProductDto>>>> GetExpiring([FromQuery] Guid? branchId, [FromQuery] int days = 90, CancellationToken ct = default)
    {
        try
        {
            var result = await _productService.GetExpiringAsync(branchId, days, ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting expiring products");
            return BadRequestResponse<List<ProductDto>>("Failed to retrieve expiring products");
        }
    }

    /// <summary>
    /// Create a new product
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<ProductDto>>> Create([FromBody] CreateProductRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _productService.CreateAsync(request, ct);
            return Created(result, nameof(GetById), new { id = result.Id });
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse<ProductDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating product");
            return BadRequestResponse<ProductDto>("Failed to create product");
        }
    }

    /// <summary>
    /// Update an existing product
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProductDto>>> Update(Guid id, [FromBody] UpdateProductRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _productService.UpdateAsync(id, request, ct);
            return Success(result, "Product updated successfully");
        }
        catch (KeyNotFoundException ex)
        {
            return NotFoundResponse<ProductDto>(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse<ProductDto>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating product {Id}", id);
            return BadRequestResponse<ProductDto>("Failed to update product");
        }
    }

    /// <summary>
    /// Soft delete a product
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _productService.DeleteAsync(id, ct);
            if (!result) return NotFoundResponse<bool>("Product not found");
            return Success(true, "Product deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting product {Id}", id);
            return BadRequestResponse<bool>("Failed to delete product");
        }
    }

    /// <summary>
    /// Get product statistics
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<ApiResponse<ProductStatsDto>>> GetStats([FromQuery] Guid? branchId, CancellationToken ct)
    {
        try
        {
            var result = await _productService.GetStatsAsync(branchId, ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product stats");
            return BadRequestResponse<ProductStatsDto>("Failed to retrieve product statistics");
        }
    }

    /// <summary>
    /// Get all product categories
    /// </summary>
    [HttpGet("categories")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetCategories(CancellationToken ct)
    {
        try
        {
            var result = await _productService.GetCategoriesAsync(ct);
            return Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting categories");
            return BadRequestResponse<List<string>>("Failed to retrieve categories");
        }
    }
}
