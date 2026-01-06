using ThurayyaPharmacy.Application.Interfaces;
using ThurayyaPharmacy.Infrastructure.Data;
using ThurayyaPharmacy.Infrastructure.Services;

namespace ThurayyaPharmacy.API.Extensions;

/// <summary>
/// Extension methods for registering application services with DI.
/// </summary>
public static class ServiceExtensions
{
    /// <summary>
    /// Registers all application services.
    /// </summary>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // Infrastructure services
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentTenantService, CurrentTenantService>();

        // Singleton services (thread-safe, one instance)
        services.AddSingleton<ICacheService, CacheService>();

        // Scoped services (one per request)
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IInvoiceService, InvoiceService>();
        services.AddScoped<IBranchService, BranchService>();
        services.AddScoped<ISupplierService, SupplierService>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IPasswordService, PasswordService>();
        services.AddScoped<IValidationService, ValidationService>();
        services.AddScoped<IGoogleAuthService, GoogleAuthService>();

        return services;
    }

    /// <summary>
    /// Adds HttpClient configurations for external services.
    /// </summary>
    public static IServiceCollection AddExternalHttpClients(this IServiceCollection services)
    {
        // Google OAuth client
        services.AddHttpClient("google", client =>
        {
            client.BaseAddress = new Uri("https://oauth2.googleapis.com/");
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        return services;
    }

    /// <summary>
    /// Adds health checks for the application.
    /// </summary>
    public static IServiceCollection AddAppHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddDbContextCheck<ApplicationDbContext>("database");

        return services;
    }
}
