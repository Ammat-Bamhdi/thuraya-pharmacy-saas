using ThurayyaPharmacy.API.Extensions;
using ThurayyaPharmacy.API.Middleware;

var builder = WebApplication.CreateBuilder(args);

// ============================================================================
// SERVER CONFIGURATION (Production-ready settings)
// ============================================================================
builder.WebHost.ConfigureKestrel(options =>
{
    // Allow larger request bodies for bulk operations (10MB max)
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024;
    
    // Increase timeouts for bulk operations
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(2);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
});

// ============================================================================
// LOGGING
// ============================================================================
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
if (!builder.Environment.IsDevelopment())
{
    builder.Logging.SetMinimumLevel(LogLevel.Warning);
}

// ============================================================================
// SERVICES CONFIGURATION
// ============================================================================

// Controllers with JSON defaults
builder.Services.AddControllersWithJsonDefaults();

// API Versioning
builder.Services.AddApiVersioningConfiguration();

// Swagger (Development Only)
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new() { Title = "Thurayya Pharmacy API", Version = "v1" });
    });
}

// Response Compression
builder.Services.AddOptimizedCompression();

// Database
builder.Services.AddDatabase(builder.Configuration, builder.Environment);

// Caching
builder.Services.AddMemoryCache();
builder.Services.AddOutputCachePolicies();

// Rate Limiting
builder.Services.AddApiRateLimiting();

// Authentication
builder.Services.AddJwtAuthentication(builder.Configuration);

// CORS
builder.Services.AddFrontendCors(builder.Configuration);

// Health Checks
builder.Services.AddAppHealthChecks();

// Application Services
builder.Services.AddApplicationServices();

// HTTP Clients
builder.Services.AddExternalHttpClients();

var app = builder.Build();

// ============================================================================
// MIDDLEWARE PIPELINE (Order Matters!)
// ============================================================================

// Get allowed origins for custom CORS middleware
var allowedOrigins = builder.Configuration.GetAllowedOrigins();

// 1. Response Compression
app.UseResponseCompression();

// 2. Correlation ID Tracking
app.UseCorrelationId();

// 3. Global Exception Handler
app.UseGlobalExceptionHandling(app.Environment);

// 4. Security Headers
app.UseSecurityHeaders(app.Environment);

// 5. Health Check
app.MapHealthChecks("/health");

// 6. Custom CORS (IIS compatibility)
app.UseCustomCors(allowedOrigins);
app.UseCors("AllowFrontend");

// 7. Rate Limiting
app.UseRateLimiter();

// 8. Output Caching
app.UseOutputCache();

// 9. Authentication & Authorization
app.UseAuthentication();
app.UseAuthorization();

// 10. Swagger (Development Only)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Thurayya Pharmacy API v1");
        c.RoutePrefix = string.Empty;
    });
}

// 11. Map Controllers
app.MapControllers();

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================
await app.InitializeDatabaseAsync();

app.Run();
