namespace ThurayyaPharmacy.Application.Interfaces;

/// <summary>
/// Service for sending transactional emails
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Send an invitation email to a new team member
    /// </summary>
    /// <param name="toEmail">Recipient email address</param>
    /// <param name="toName">Recipient name</param>
    /// <param name="orgName">Organization name</param>
    /// <param name="orgSlug">Organization slug for login URL</param>
    /// <param name="inviterName">Name of the person who invited them</param>
    /// <param name="ct">Cancellation token</param>
    Task<bool> SendInvitationEmailAsync(
        string toEmail,
        string toName,
        string orgName,
        string orgSlug,
        string inviterName,
        CancellationToken ct = default);
}
