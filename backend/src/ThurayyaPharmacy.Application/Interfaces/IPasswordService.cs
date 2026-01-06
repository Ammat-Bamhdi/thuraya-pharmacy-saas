namespace ThurayyaPharmacy.Application.Interfaces;

/// <summary>
/// Service for password hashing and verification using BCrypt.
/// </summary>
public interface IPasswordService
{
    /// <summary>
    /// Hashes a plain text password using BCrypt with configured work factor.
    /// </summary>
    /// <param name="password">The plain text password.</param>
    /// <returns>The BCrypt hash.</returns>
    string HashPassword(string password);

    /// <summary>
    /// Verifies a plain text password against a BCrypt hash.
    /// </summary>
    /// <param name="password">The plain text password to verify.</param>
    /// <param name="hash">The stored BCrypt hash.</param>
    /// <returns>True if the password matches, false otherwise.</returns>
    bool VerifyPassword(string password, string hash);
}
