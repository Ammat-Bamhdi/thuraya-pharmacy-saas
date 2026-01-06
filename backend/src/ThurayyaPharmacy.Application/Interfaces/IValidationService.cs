using System.Net.Mail;
using ThurayyaPharmacy.Application.DTOs;

namespace ThurayyaPharmacy.Application.Interfaces;

/// <summary>
/// Service for input validation with comprehensive password and email rules.
/// </summary>
public interface IValidationService
{
    /// <summary>
    /// Validates a registration request and returns any errors.
    /// </summary>
    List<string> ValidateRegisterRequest(RegisterRequest request);

    /// <summary>
    /// Validates a password against security requirements.
    /// </summary>
    List<string> ValidatePassword(string password);

    /// <summary>
    /// Checks if an email address is in a valid format.
    /// </summary>
    bool IsValidEmail(string email);

    /// <summary>
    /// Normalizes an email address (trim and lowercase).
    /// </summary>
    string NormalizeEmail(string email);
}
