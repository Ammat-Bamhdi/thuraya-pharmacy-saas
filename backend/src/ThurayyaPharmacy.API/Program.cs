using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ThurayyaPharmacy.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// ============================================================================
// CONFIGURATION SOURCES (in order of precedence):
// 1. appsettings.json (base configuration)
// 2. appsettings.{Environment}.json (environment-specific)
// 3. Environment variables (highest priority - used by AWS EB)
// ============================================================================
// AWS Elastic Beanstalk automatically maps Secrets Manager values to 
// environment variables. No additional SDK required.
// ============================================================================

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Use camelCase for JSON property names (JavaScript convention)
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        // Serialize enums as strings instead of integers
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================
// Supports both SQL Server (development) and PostgreSQL (production AWS RDS)
// Set "DatabaseProvider" to "PostgreSQL" or "SqlServer" in configuration
// ============================================================================
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
        ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required");
    
    var databaseProvider = builder.Configuration["DatabaseProvider"] ?? "SqlServer";
    
    if (databaseProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
    {
        options.UseNpgsql(connectionString);
    }
    else
    {
        options.UseSqlServer(connectionString);
    }
});

// JWT Authentication - Fail fast if not configured
var jwtKey = builder.Configuration["Jwt:Key"] 
    ?? throw new InvalidOperationException(
        "Jwt:Key is required. " +
        "Development: Use 'dotnet user-secrets set Jwt:Key <your-key>'. " +
        "Production: Use AWS Secrets Manager via environment variables.");

if (jwtKey.Length < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key must be at least 32 characters (256 bits) for HS256 algorithm.");
}

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "ThurayyaPharmacy";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "ThurayyaPharmacyApp";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// CORS for frontend - configurable for different environments
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:3000", "http://localhost:4200" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// ============================================================================
// HEALTH CHECK ENDPOINT (Required for AWS Elastic Beanstalk Load Balancer)
// ============================================================================
builder.Services.AddHealthChecks();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Thurayya Pharmacy API v1");
        c.RoutePrefix = string.Empty; // Swagger at root
    });
}

// Health check endpoint for AWS ELB health checks
app.MapHealthChecks("/health");

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Initialize database schema on startup
// EnsureCreated() creates the schema if it doesn't exist (works with any provider)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        logger.LogInformation("Ensuring database schema exists...");
        db.Database.EnsureCreated();
        logger.LogInformation("Database schema initialized successfully.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred while initializing the database.");
        throw; // Fail fast - can't run without database
    }
}

app.Run();
