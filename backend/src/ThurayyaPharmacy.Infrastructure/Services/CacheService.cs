using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using ThurayyaPharmacy.Application.Interfaces;

namespace ThurayyaPharmacy.Infrastructure.Services;

/// <summary>
/// High-performance cache service implementation using IMemoryCache.
/// Provides thread-safe caching with automatic key tracking for prefix-based invalidation.
/// </summary>
public sealed class CacheService : ICacheService
{
    private readonly IMemoryCache _cache;
    private readonly ILogger<CacheService> _logger;
    private readonly ConcurrentDictionary<string, bool> _keyRegistry = new();
    private readonly SemaphoreSlim _lock = new(1, 1);

    public CacheService(IMemoryCache cache, ILogger<CacheService> logger)
    {
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<T> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? absoluteExpiration = null,
        TimeSpan? slidingExpiration = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        ArgumentNullException.ThrowIfNull(factory);

        if (_cache.TryGetValue(key, out T? cachedValue) && cachedValue is not null)
        {
            _logger.LogDebug("Cache hit for key: {CacheKey}", key);
            return cachedValue;
        }

        // Use semaphore to prevent cache stampede (multiple simultaneous calls for same key)
        await _lock.WaitAsync(cancellationToken);
        try
        {
            // Double-check after acquiring lock
            if (_cache.TryGetValue(key, out cachedValue) && cachedValue is not null)
            {
                return cachedValue;
            }

            _logger.LogDebug("Cache miss for key: {CacheKey}, invoking factory", key);

            var value = await factory(cancellationToken);

            var options = CreateCacheOptions(absoluteExpiration, slidingExpiration, key);
            _cache.Set(key, value, options);
            _keyRegistry.TryAdd(key, true);

            return value;
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <inheritdoc />
    public T? Get<T>(string key)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        
        var found = _cache.TryGetValue(key, out T? value);
        _logger.LogDebug("Cache {Result} for key: {CacheKey}", found ? "hit" : "miss", key);
        
        return value;
    }

    /// <inheritdoc />
    public bool TryGet<T>(string key, out T? value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        
        var found = _cache.TryGetValue(key, out value);
        _logger.LogDebug("Cache {Result} for key: {CacheKey}", found ? "hit" : "miss", key);
        
        return found;
    }

    /// <inheritdoc />
    public void Set<T>(string key, T value, TimeSpan? absoluteExpiration = null, TimeSpan? slidingExpiration = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        var options = CreateCacheOptions(absoluteExpiration, slidingExpiration, key);
        _cache.Set(key, value, options);
        _keyRegistry.TryAdd(key, true);

        _logger.LogDebug("Cached value for key: {CacheKey}", key);
    }

    /// <inheritdoc />
    public void Remove(string key)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        _cache.Remove(key);
        _keyRegistry.TryRemove(key, out _);

        _logger.LogDebug("Removed cache key: {CacheKey}", key);
    }

    /// <inheritdoc />
    public void RemoveByPrefix(string prefix)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(prefix);

        var keysToRemove = _keyRegistry.Keys
            .Where(k => k.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            .ToList();

        foreach (var key in keysToRemove)
        {
            _cache.Remove(key);
            _keyRegistry.TryRemove(key, out _);
        }

        _logger.LogInformation("Removed {Count} cache entries with prefix: {Prefix}", keysToRemove.Count, prefix);
    }

    private MemoryCacheEntryOptions CreateCacheOptions(
        TimeSpan? absoluteExpiration,
        TimeSpan? slidingExpiration,
        string key)
    {
        var options = new MemoryCacheEntryOptions
        {
            Priority = CacheItemPriority.Normal
        };

        if (absoluteExpiration.HasValue)
        {
            options.AbsoluteExpirationRelativeToNow = absoluteExpiration.Value;
        }
        else
        {
            // Default absolute expiration of 30 minutes
            options.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
        }

        if (slidingExpiration.HasValue)
        {
            options.SlidingExpiration = slidingExpiration.Value;
        }

        // Register callback to clean up key registry on eviction
        options.RegisterPostEvictionCallback((evictedKey, value, reason, state) =>
        {
            _keyRegistry.TryRemove(evictedKey.ToString()!, out _);
            _logger.LogDebug("Cache entry evicted: {Key}, Reason: {Reason}", evictedKey, reason);
        });

        return options;
    }
}
