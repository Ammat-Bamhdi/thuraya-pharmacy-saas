namespace ThurayyaPharmacy.API.Extensions;

/// <summary>
/// Extension methods for configuring security headers middleware.
/// </summary>
public static class SecurityHeadersExtensions
{
    /// <summary>
    /// Adds security headers to all responses.
    /// </summary>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app, IWebHostEnvironment environment)
    {
        return app.Use(async (context, next) =>
        {
            context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
            context.Response.Headers.Append("X-Frame-Options", "DENY");
            context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
            context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

            if (!environment.IsDevelopment())
            {
                context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            }

            await next();
        });
    }

    /// <summary>
    /// Adds custom CORS middleware for IIS compatibility.
    /// </summary>
    public static IApplicationBuilder UseCustomCors(this IApplicationBuilder app, string[] allowedOrigins)
    {
        return app.Use(async (context, next) =>
        {
            var origin = context.Request.Headers.Origin.FirstOrDefault();

            if (!string.IsNullOrEmpty(origin) && allowedOrigins.Contains(origin))
            {
                context.Response.Headers.Append("Access-Control-Allow-Origin", origin);
                context.Response.Headers.Append("Access-Control-Allow-Credentials", "true");

                if (context.Request.Method == "OPTIONS")
                {
                    context.Response.Headers.Append("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
                    context.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Api-Version, X-Correlation-ID, X-Request-ID");
                    context.Response.Headers.Append("Access-Control-Max-Age", "86400");
                    context.Response.StatusCode = 204;
                    return;
                }
            }

            await next();
        });
    }

    /// <summary>
    /// Adds global exception handling with correlation ID support.
    /// </summary>
    public static IApplicationBuilder UseGlobalExceptionHandling(this IApplicationBuilder app, IWebHostEnvironment environment)
    {
        return app.UseExceptionHandler(options =>
        {
            options.Run(async context =>
            {
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json";

                var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
                var exceptionFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
                var exception = exceptionFeature?.Error;

                var correlationId = context.Items["CorrelationId"]?.ToString() ?? "unknown";

                logger.LogError(exception, "Unhandled exception [CorrelationId: {CorrelationId}]: {Message}",
                    correlationId, exception?.Message);

                var response = new
                {
                    success = false,
                    message = environment.IsDevelopment()
                        ? exception?.Message
                        : "An unexpected error occurred. Please try again later.",
                    correlationId
                };

                await context.Response.WriteAsJsonAsync(response);
            });
        });
    }
}
