using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Resend;
using ThurayyaPharmacy.Application.Interfaces;

namespace ThurayyaPharmacy.Infrastructure.Services;

/// <summary>
/// Email service using Resend for transactional emails
/// </summary>
public class EmailService : IEmailService
{
    private readonly IResend? _resend;
    private readonly ILogger<EmailService> _logger;
    private readonly string _fromEmail;
    private readonly string _fromName;
    private readonly string _baseUrl;

    public EmailService(
        IConfiguration configuration,
        ILogger<EmailService> logger,
        IResend? resend = null)
    {
        _resend = resend;
        _logger = logger;
        
        _fromEmail = configuration["Resend:FromEmail"] ?? "noreply@thuraya.io";
        _fromName = configuration["Resend:FromName"] ?? "Thuraya Pharmacy";
        _baseUrl = configuration["App:BaseUrl"] ?? "https://thuraya.io";
    }

    public async Task<bool> SendInvitationEmailAsync(
        string toEmail,
        string toName,
        string orgName,
        string orgSlug,
        string inviterName,
        CancellationToken ct = default)
    {
        // If Resend is not configured, log and return success (dev mode)
        if (_resend == null)
        {
            _logger.LogWarning(
                "[DEV MODE] Email would be sent to {Email} for org {OrgSlug}. Configure Resend:ApiKey to send real emails.",
                toEmail, orgSlug);
            return true;
        }

        try
        {
            var loginUrl = $"{_baseUrl}/{orgSlug}";
            
            var htmlBody = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>You've been invited to join {orgName}</title>
</head>
<body style=""margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;"">
    <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
        <tr>
            <td align=""center"" style=""padding: 40px 0;"">
                <table role=""presentation"" style=""width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"">
                    <!-- Header -->
                    <tr>
                        <td style=""padding: 40px 40px 20px; text-align: center;"">
                            <h1 style=""margin: 0; color: #0d9488; font-size: 28px; font-weight: 600;"">Thuraya Pharmacy</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style=""padding: 20px 40px 40px;"">
                            <h2 style=""margin: 0 0 20px; color: #1e293b; font-size: 24px; font-weight: 600;"">
                                You've been invited!
                            </h2>
                            
                            <p style=""margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 24px;"">
                                Hi {toName},
                            </p>
                            
                            <p style=""margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 24px;"">
                                <strong>{inviterName}</strong> has invited you to join <strong>{orgName}</strong> on Thuraya Pharmacy.
                            </p>
                            
                            <p style=""margin: 0 0 30px; color: #475569; font-size: 16px; line-height: 24px;"">
                                Click the button below to accept your invitation and get started.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role=""presentation"" style=""width: 100%; border-collapse: collapse;"">
                                <tr>
                                    <td align=""center"">
                                        <a href=""{loginUrl}"" 
                                           style=""display: inline-block; padding: 14px 32px; background-color: #0d9488; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;"">
                                            Accept Invitation
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style=""margin: 30px 0 0; color: #94a3b8; font-size: 14px; line-height: 20px;"">
                                Or copy and paste this URL into your browser:<br>
                                <a href=""{loginUrl}"" style=""color: #0d9488;"">{loginUrl}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style=""padding: 20px 40px; background-color: #f1f5f9; border-radius: 0 0 12px 12px;"">
                            <p style=""margin: 0; color: #64748b; font-size: 12px; line-height: 18px; text-align: center;"">
                                This email was sent by Thuraya Pharmacy.<br>
                                If you didn't expect this invitation, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";

            var textBody = $@"You've been invited to join {orgName}

Hi {toName},

{inviterName} has invited you to join {orgName} on Thuraya Pharmacy.

Click the link below to accept your invitation:
{loginUrl}

If you didn't expect this invitation, you can safely ignore this email.

---
Thuraya Pharmacy";

            var message = new EmailMessage
            {
                From = $"{_fromName} <{_fromEmail}>",
                To = toEmail,
                Subject = $"You've been invited to join {orgName} on Thuraya",
                HtmlBody = htmlBody,
                TextBody = textBody
            };

            var response = await _resend.EmailSendAsync(message, ct);
            
            _logger.LogInformation(
                "Invitation email sent to {Email} for org {OrgSlug}. MessageId: {MessageId}",
                toEmail, orgSlug, response?.Content);
            
            return response?.Success ?? false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send invitation email to {Email} for org {OrgSlug}", toEmail, orgSlug);
            return false;
        }
    }
}
