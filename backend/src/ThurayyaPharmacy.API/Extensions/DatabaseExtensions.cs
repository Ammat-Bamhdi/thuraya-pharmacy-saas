using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Infrastructure.Data;

namespace ThurayyaPharmacy.API.Extensions;

/// <summary>
/// Extension methods for configuring Entity Framework database context.
/// </summary>
public static class DatabaseExtensions
{
    /// <summary>
    /// Adds the ApplicationDbContext with optimized settings.
    /// </summary>
    public static IServiceCollection AddDatabase(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Database connection string is required");

        var databaseProvider = configuration["DatabaseProvider"] ?? "SqlServer";

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            if (databaseProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
            {
                options.UseNpgsql(connectionString, npgsqlOptions =>
                {
                    npgsqlOptions.CommandTimeout(30);
                    npgsqlOptions.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null);
                    npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
                });
            }
            else
            {
                options.UseSqlServer(connectionString, sqlOptions =>
                {
                    sqlOptions.CommandTimeout(30);
                    sqlOptions.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null);
                    sqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
                });
            }

            // Performance optimizations
            options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTrackingWithIdentityResolution);

            if (environment.IsDevelopment())
            {
                options.EnableSensitiveDataLogging();
                options.EnableDetailedErrors();
            }
        });

        return services;
    }

    /// <summary>
    /// Ensures the database is created and migrated.
    /// </summary>
    public static async Task InitializeDatabaseAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<ApplicationDbContext>>();

        try
        {
            if (dbContext.Database.IsRelational())
            {
                // In development, use EnsureCreated for quick setup
                // In production, use migrations
                if (app.Environment.IsDevelopment())
                {
                    await dbContext.Database.EnsureCreatedAsync();
                    logger.LogInformation("Database ensured created successfully");
                }
                else
                {
                    var pendingMigrations = await dbContext.Database.GetPendingMigrationsAsync();
                    if (pendingMigrations.Any())
                    {
                        logger.LogInformation("Applying {Count} pending migrations...", pendingMigrations.Count());
                        await dbContext.Database.MigrateAsync();
                        logger.LogInformation("Database migration completed successfully");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Database initialization failed. This may be expected on first run.");
        }
    }
}
