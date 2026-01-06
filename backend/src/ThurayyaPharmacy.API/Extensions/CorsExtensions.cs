namespace ThurayyaPharmacy.API.Extensions;

/// <summary>
/// Extension methods for configuring CORS.
/// </summary>
public static class CorsExtensions
{
    /// <summary>
    /// Default allowed origins when none are configured.
    /// </summary>
    private static readonly string[] DefaultOrigins = new[]
    {
        "http://localhost:3000",
        "http://localhost:4200",
        "http://localhost:5173", // Vite default
        "https://thuraya-pharmacy-saas.vercel.app",
        "https://d1duu60y0sihvr.cloudfront.net"
    };

    /// <summary>
    /// Adds CORS configuration for the frontend.
    /// </summary>
    public static IServiceCollection AddFrontendCors(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? DefaultOrigins;

        services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
            {
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .AllowCredentials()
                    .SetPreflightMaxAge(TimeSpan.FromHours(24));
            });
        });

        return services;
    }

    /// <summary>
    /// Gets the allowed origins from configuration.
    /// </summary>
    public static string[] GetAllowedOrigins(this IConfiguration configuration)
    {
        return configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? DefaultOrigins;
    }
}
