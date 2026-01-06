using System.Text.RegularExpressions;
using System.Web;

namespace ThurayyaPharmacy.Application.Helpers;

/// <summary>
/// Provides input sanitization methods to prevent XSS and injection attacks
/// </summary>
public static partial class InputSanitizer
{
    // Regex patterns for validation
    private static readonly Regex EmailPattern = MyEmailRegex();
    private static readonly Regex PhonePattern = MyPhoneRegex();
    private static readonly Regex AlphanumericPattern = MyAlphanumericRegex();

    /// <summary>
    /// Sanitizes a string by encoding HTML entities and trimming whitespace
    /// </summary>
    public static string? Sanitize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return input?.Trim();

        // Trim whitespace
        var sanitized = input.Trim();

        // Encode HTML entities to prevent XSS
        sanitized = HttpUtility.HtmlEncode(sanitized);

        return sanitized;
    }

    /// <summary>
    /// Sanitizes a string for use in searches (removes special characters)
    /// </summary>
    public static string? SanitizeForSearch(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return null;

        // Remove potentially dangerous characters for LIKE queries
        var sanitized = input.Trim()
            .Replace("%", "")
            .Replace("_", "")
            .Replace("[", "")
            .Replace("]", "")
            .Replace("'", "")
            .Replace("\"", "")
            .Replace(";", "")
            .Replace("--", "");

        return sanitized.Length > 0 ? sanitized : null;
    }

    /// <summary>
    /// Validates and normalizes an email address
    /// </summary>
    public static string? NormalizeEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return null;

        var normalized = email.Trim().ToLowerInvariant();
        return EmailPattern.IsMatch(normalized) ? normalized : null;
    }

    /// <summary>
    /// Validates and normalizes a phone number (removes formatting)
    /// </summary>
    public static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return null;

        // Remove all non-digit characters except + at the start
        var normalized = phone.Trim();
        var hasPlus = normalized.StartsWith('+');
        normalized = new string(normalized.Where(char.IsDigit).ToArray());

        if (hasPlus && normalized.Length > 0)
            normalized = "+" + normalized;

        return normalized.Length >= 7 ? normalized : null;
    }

    /// <summary>
    /// Sanitizes a code/SKU (alphanumeric only with dashes and underscores)
    /// </summary>
    public static string? SanitizeCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return null;

        var sanitized = code.Trim().ToUpperInvariant();
        
        // Only allow alphanumeric, dashes, and underscores
        sanitized = AlphanumericPattern.Replace(sanitized, "");

        return sanitized.Length > 0 ? sanitized : null;
    }

    /// <summary>
    /// Validates that a string contains only safe characters for names
    /// </summary>
    public static bool IsValidName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return false;

        // Reject if contains script tags or SQL injection patterns
        var lower = name.ToLowerInvariant();
        return !lower.Contains("<script") &&
               !lower.Contains("javascript:") &&
               !lower.Contains("onerror=") &&
               !lower.Contains("onclick=") &&
               !lower.Contains("--") &&
               !lower.Contains("/*") &&
               !lower.Contains("*/");
    }

    /// <summary>
    /// Truncates a string to a maximum length
    /// </summary>
    public static string? Truncate(string? input, int maxLength)
    {
        if (string.IsNullOrEmpty(input) || input.Length <= maxLength)
            return input;

        return input[..maxLength];
    }

    [GeneratedRegex(@"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", RegexOptions.Compiled)]
    private static partial Regex MyEmailRegex();

    [GeneratedRegex(@"^\+?[0-9]{7,15}$", RegexOptions.Compiled)]
    private static partial Regex MyPhoneRegex();

    [GeneratedRegex(@"[^a-zA-Z0-9\-_]", RegexOptions.Compiled)]
    private static partial Regex MyAlphanumericRegex();
}
