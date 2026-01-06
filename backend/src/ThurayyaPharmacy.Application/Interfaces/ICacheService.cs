using System;
using System.Threading;
using System.Threading.Tasks;

namespace ThurayyaPharmacy.Application.Interfaces;

/// <summary>
/// Provides a clean abstraction for caching operations.
/// Supports both synchronous and asynchronous cache patterns with type safety.
/// </summary>
public interface ICacheService
{
    /// <summary>
    /// Gets a value from cache, or creates and caches it if not present.
    /// </summary>
    /// <typeparam name="T">The type of the cached value.</typeparam>
    /// <param name="key">The cache key.</param>
    /// <param name="factory">Factory function to create the value if not in cache.</param>
    /// <param name="absoluteExpiration">Optional absolute expiration timespan.</param>
    /// <param name="slidingExpiration">Optional sliding expiration timespan.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The cached or newly created value.</returns>
    Task<T> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? absoluteExpiration = null,
        TimeSpan? slidingExpiration = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a value from cache if it exists.
    /// </summary>
    /// <typeparam name="T">The type of the cached value.</typeparam>
    /// <param name="key">The cache key.</param>
    /// <returns>The cached value, or default if not found.</returns>
    T? Get<T>(string key);

    /// <summary>
    /// Attempts to get a value from cache.
    /// </summary>
    /// <typeparam name="T">The type of the cached value.</typeparam>
    /// <param name="key">The cache key.</param>
    /// <param name="value">The cached value if found.</param>
    /// <returns>True if the value was found, false otherwise.</returns>
    bool TryGet<T>(string key, out T? value);

    /// <summary>
    /// Sets a value in cache with optional expiration.
    /// </summary>
    /// <typeparam name="T">The type of the value to cache.</typeparam>
    /// <param name="key">The cache key.</param>
    /// <param name="value">The value to cache.</param>
    /// <param name="absoluteExpiration">Optional absolute expiration timespan.</param>
    /// <param name="slidingExpiration">Optional sliding expiration timespan.</param>
    void Set<T>(string key, T value, TimeSpan? absoluteExpiration = null, TimeSpan? slidingExpiration = null);

    /// <summary>
    /// Removes a value from cache.
    /// </summary>
    /// <param name="key">The cache key to remove.</param>
    void Remove(string key);

    /// <summary>
    /// Removes all cache entries matching a prefix pattern.
    /// </summary>
    /// <param name="prefix">The cache key prefix.</param>
    void RemoveByPrefix(string prefix);
}

/// <summary>
/// Common cache key patterns for the application.
/// </summary>
public static class CacheKeys
{
    public const string Products = "products";
    public const string Suppliers = "suppliers";
    public const string Customers = "customers";
    public const string Branches = "branches";
    public const string Users = "users";

    /// <summary>
    /// Generates a cache key for a specific entity by ID.
    /// </summary>
    public static string ForEntity(string prefix, Guid id) => $"{prefix}:{id}";

    /// <summary>
    /// Generates a cache key for a tenant's entity list.
    /// </summary>
    public static string ForTenant(string prefix, Guid tenantId) => $"{prefix}:tenant:{tenantId}";

    /// <summary>
    /// Generates a cache key for a paginated query.
    /// </summary>
    public static string ForPage(string prefix, Guid tenantId, int page, int pageSize) =>
        $"{prefix}:tenant:{tenantId}:page:{page}:size:{pageSize}";

    /// <summary>
    /// Generates a cache key for a search query.
    /// </summary>
    public static string ForSearch(string prefix, Guid tenantId, string searchTerm) =>
        $"{prefix}:tenant:{tenantId}:search:{searchTerm?.ToLowerInvariant() ?? "all"}";
}

/// <summary>
/// Default cache durations for different entity types.
/// </summary>
public static class CacheDurations
{
    /// <summary>Short-lived cache for frequently changing data (1 minute).</summary>
    public static readonly TimeSpan Short = TimeSpan.FromMinutes(1);

    /// <summary>Medium cache duration for moderately changing data (5 minutes).</summary>
    public static readonly TimeSpan Medium = TimeSpan.FromMinutes(5);

    /// <summary>Long cache duration for rarely changing data (15 minutes).</summary>
    public static readonly TimeSpan Long = TimeSpan.FromMinutes(15);

    /// <summary>Extended cache duration for static data (1 hour).</summary>
    public static readonly TimeSpan Extended = TimeSpan.FromHours(1);
}
