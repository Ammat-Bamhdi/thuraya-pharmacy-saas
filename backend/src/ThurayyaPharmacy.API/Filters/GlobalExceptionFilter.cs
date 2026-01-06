using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;

namespace ThurayyaPharmacy.API.Filters;

/// <summary>
/// Global exception filter that provides consistent error responses across all controllers.
/// Handles common exceptions and converts them to appropriate HTTP status codes.
/// </summary>
public sealed class GlobalExceptionFilter : IExceptionFilter
{
    private readonly ILogger<GlobalExceptionFilter> _logger;
    private readonly IHostEnvironment _environment;

    public GlobalExceptionFilter(ILogger<GlobalExceptionFilter> logger, IHostEnvironment environment)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _environment = environment ?? throw new ArgumentNullException(nameof(environment));
    }

    public void OnException(ExceptionContext context)
    {
        var exception = context.Exception;
        var correlationId = context.HttpContext.Items["CorrelationId"]?.ToString() ?? "unknown";

        var (statusCode, errorResponse) = exception switch
        {
            ValidationException validationEx => HandleValidationException(validationEx, correlationId),
            UnauthorizedAccessException => HandleUnauthorizedException(correlationId),
            KeyNotFoundException notFoundEx => HandleNotFoundException(notFoundEx, correlationId),
            InvalidOperationException invalidOpEx => HandleInvalidOperationException(invalidOpEx, correlationId),
            ArgumentException argEx => HandleArgumentException(argEx, correlationId),
            TimeoutException => HandleTimeoutException(correlationId),
            OperationCanceledException => HandleCanceledException(correlationId),
            _ => HandleGenericException(exception, correlationId)
        };

        // Log based on severity
        if (statusCode >= 500)
        {
            _logger.LogError(exception, 
                "Server error [CorrelationId: {CorrelationId}]: {ExceptionType} - {Message}", 
                correlationId, exception.GetType().Name, exception.Message);
        }
        else
        {
            _logger.LogWarning(
                "Client error [CorrelationId: {CorrelationId}]: {ExceptionType} - {Message}", 
                correlationId, exception.GetType().Name, exception.Message);
        }

        context.Result = new ObjectResult(errorResponse)
        {
            StatusCode = statusCode
        };

        context.ExceptionHandled = true;
    }

    private (int statusCode, object response) HandleValidationException(ValidationException ex, string correlationId)
    {
        return ((int)HttpStatusCode.BadRequest, new ErrorResponse
        {
            Success = false,
            Message = ex.Message,
            CorrelationId = correlationId,
            ErrorCode = "VALIDATION_ERROR"
        });
    }

    private (int statusCode, object response) HandleUnauthorizedException(string correlationId)
    {
        return ((int)HttpStatusCode.Unauthorized, new ErrorResponse
        {
            Success = false,
            Message = "You are not authorized to perform this action.",
            CorrelationId = correlationId,
            ErrorCode = "UNAUTHORIZED"
        });
    }

    private (int statusCode, object response) HandleNotFoundException(KeyNotFoundException ex, string correlationId)
    {
        return ((int)HttpStatusCode.NotFound, new ErrorResponse
        {
            Success = false,
            Message = ex.Message.Length > 0 ? ex.Message : "The requested resource was not found.",
            CorrelationId = correlationId,
            ErrorCode = "NOT_FOUND"
        });
    }

    private (int statusCode, object response) HandleInvalidOperationException(InvalidOperationException ex, string correlationId)
    {
        return ((int)HttpStatusCode.BadRequest, new ErrorResponse
        {
            Success = false,
            Message = ex.Message,
            CorrelationId = correlationId,
            ErrorCode = "INVALID_OPERATION"
        });
    }

    private (int statusCode, object response) HandleArgumentException(ArgumentException ex, string correlationId)
    {
        return ((int)HttpStatusCode.BadRequest, new ErrorResponse
        {
            Success = false,
            Message = ex.Message,
            CorrelationId = correlationId,
            ErrorCode = "INVALID_ARGUMENT"
        });
    }

    private (int statusCode, object response) HandleTimeoutException(string correlationId)
    {
        return ((int)HttpStatusCode.GatewayTimeout, new ErrorResponse
        {
            Success = false,
            Message = "The request timed out. Please try again.",
            CorrelationId = correlationId,
            ErrorCode = "TIMEOUT"
        });
    }

    private (int statusCode, object response) HandleCanceledException(string correlationId)
    {
        return (499, new ErrorResponse  // Client Closed Request
        {
            Success = false,
            Message = "The request was cancelled.",
            CorrelationId = correlationId,
            ErrorCode = "REQUEST_CANCELLED"
        });
    }

    private (int statusCode, object response) HandleGenericException(Exception ex, string correlationId)
    {
        var message = _environment.IsDevelopment()
            ? ex.Message
            : "An unexpected error occurred. Please try again later.";

        var response = new ErrorResponse
        {
            Success = false,
            Message = message,
            CorrelationId = correlationId,
            ErrorCode = "INTERNAL_ERROR",
            Details = _environment.IsDevelopment() ? ex.StackTrace : null
        };

        return ((int)HttpStatusCode.InternalServerError, response);
    }
}

/// <summary>
/// Standardized error response structure.
/// </summary>
public sealed class ErrorResponse
{
    public bool Success { get; init; } = false;
    public required string Message { get; init; }
    public required string CorrelationId { get; init; }
    public string? ErrorCode { get; init; }
    public string? Details { get; init; }
}

/// <summary>
/// Extension methods for registering the global exception filter.
/// </summary>
public static class GlobalExceptionFilterExtensions
{
    /// <summary>
    /// Adds the global exception filter to MVC options.
    /// </summary>
    public static IMvcBuilder AddGlobalExceptionFilter(this IMvcBuilder builder)
    {
        builder.Services.AddScoped<GlobalExceptionFilter>();
        return builder.AddMvcOptions(options =>
        {
            options.Filters.Add<GlobalExceptionFilter>();
        });
    }
}
