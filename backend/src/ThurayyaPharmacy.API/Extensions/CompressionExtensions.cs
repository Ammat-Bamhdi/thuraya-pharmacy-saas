using System.IO.Compression;
using Microsoft.AspNetCore.ResponseCompression;

namespace ThurayyaPharmacy.API.Extensions;

/// <summary>
/// Extension methods for configuring response compression.
/// </summary>
public static class CompressionExtensions
{
    /// <summary>
    /// Adds Brotli and Gzip compression with optimized settings.
    /// </summary>
    public static IServiceCollection AddOptimizedCompression(this IServiceCollection services)
    {
        services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
            {
                "application/json",
                "application/javascript",
                "text/css",
                "text/html",
                "text/json",
                "text/plain"
            });
        });

        services.Configure<BrotliCompressionProviderOptions>(options =>
        {
            options.Level = CompressionLevel.Fastest;
        });

        services.Configure<GzipCompressionProviderOptions>(options =>
        {
            options.Level = CompressionLevel.Optimal;
        });

        return services;
    }
}
