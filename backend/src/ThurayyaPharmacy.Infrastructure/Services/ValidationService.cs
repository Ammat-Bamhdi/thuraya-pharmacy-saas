using System.Net.Mail;
using ThurayyaPharmacy.Application.DTOs;
using ThurayyaPharmacy.Application.Interfaces;

namespace ThurayyaPharmacy.Infrastructure.Services;

/// <summary>
/// Implementation of IValidationService with comprehensive validation rules.
/// </summary>
public sealed class ValidationService : IValidationService
{
    private const int PasswordMinLength = 8;
    private const int NameMinLength = 2;

    /// <inheritdoc />
    public List<string> ValidateRegisterRequest(RegisterRequest request)
    {
        var errors = new List<string>();

        // Name validation
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors.Add("Name is required");
        }
        else if (request.Name.Trim().Length < NameMinLength)
        {
            errors.Add($"Name must be at least {NameMinLength} characters");
        }

        // Email validation
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            errors.Add("Email is required");
        }
        else if (!IsValidEmail(request.Email))
        {
            errors.Add("Invalid email format");
        }

        // Password validation
        if (string.IsNullOrWhiteSpace(request.Password))
        {
            errors.Add("Password is required");
        }
        else
        {
            errors.AddRange(ValidatePassword(request.Password));
        }

        // Tenant name validation
        if (string.IsNullOrWhiteSpace(request.TenantName))
        {
            errors.Add("Organization name is required");
        }

        // Country validation
        if (string.IsNullOrWhiteSpace(request.Country))
        {
            errors.Add("Country is required");
        }

        // Currency validation
        if (string.IsNullOrWhiteSpace(request.Currency))
        {
            errors.Add("Currency is required");
        }

        return errors;
    }

    /// <inheritdoc />
    public List<string> ValidatePassword(string password)
    {
        var errors = new List<string>();

        if (string.IsNullOrEmpty(password))
        {
            errors.Add("Password is required");
            return errors;
        }

        if (password.Length < PasswordMinLength)
        {
            errors.Add($"Password must be at least {PasswordMinLength} characters");
        }

        if (!password.Any(char.IsUpper))
        {
            errors.Add("Password must contain at least one uppercase letter");
        }

        if (!password.Any(char.IsLower))
        {
            errors.Add("Password must contain at least one lowercase letter");
        }

        if (!password.Any(char.IsDigit))
        {
            errors.Add("Password must contain at least one number");
        }

        return errors;
    }

    /// <inheritdoc />
    public bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        try
        {
            var addr = new MailAddress(email);
            return addr.Address == email.Trim();
        }
        catch
        {
            return false;
        }
    }

    /// <inheritdoc />
    public string NormalizeEmail(string email)
    {
        return email?.Trim().ToLowerInvariant() ?? string.Empty;
    }
}
