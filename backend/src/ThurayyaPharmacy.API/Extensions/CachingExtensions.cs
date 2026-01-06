namespace ThurayyaPharmacy.API.Extensions;

/// <summary>
/// Extension methods for configuring output caching.
/// </summary>
public static class CachingExtensions
{
    /// <summary>
    /// Adds output caching with domain-specific policies.
    /// </summary>
    public static IServiceCollection AddOutputCachePolicies(this IServiceCollection services)
    {
        services.AddOutputCache(options =>
        {
            options.DefaultExpirationTimeSpan = TimeSpan.FromMinutes(5);

            // Cache products list for 2 minutes (frequently accessed)
            options.AddPolicy("Products", policy => policy
                .Expire(TimeSpan.FromMinutes(2))
                .SetVaryByQuery("page", "pageSize", "search", "category")
                .Tag("products"));

            // Cache suppliers for 5 minutes (less frequently updated)
            options.AddPolicy("Suppliers", policy => policy
                .Expire(TimeSpan.FromMinutes(5))
                .SetVaryByQuery("page", "pageSize", "search", "status")
                .Tag("suppliers"));

            // Cache customers for 5 minutes
            options.AddPolicy("Customers", policy => policy
                .Expire(TimeSpan.FromMinutes(5))
                .SetVaryByQuery("page", "pageSize", "search", "type")
                .Tag("customers"));

            // Cache branches for 10 minutes (rarely changes)
            options.AddPolicy("Branches", policy => policy
                .Expire(TimeSpan.FromMinutes(10))
                .Tag("branches"));
        });

        return services;
    }
}
