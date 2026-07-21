using System.Net;
using System.Net.Mail;

namespace TrainWise.BL
{
    /// <summary>
    /// Sends the transactional emails for #110 (password reset) and #114 (email
    /// verification).
    ///
    /// WHY THIS EXISTS: until 2026-07-19 the backend generated and stored those
    /// 6-digit codes but never sent them anywhere, so "a reset code was sent" was
    /// not actually true and no user ever received an email. Only the
    /// AUTH_DEV_CODES escape hatch (which echoes the code back in the API
    /// response) made the flows testable.
    ///
    /// Configuration is read ENTIRELY from environment variables so no credential
    /// is ever committed to source (see the secrets rules in CLAUDE.md):
    ///   SMTP_HOST  smtp.gmail.com            (required — unset = disabled)
    ///   SMTP_PORT  587                       (default 587)
    ///   SMTP_USER  the mailbox / API user
    ///   SMTP_PASS  app password or API key
    ///   SMTP_FROM  from address              (defaults to SMTP_USER)
    ///   SMTP_SSL   "false" to disable STARTTLS (default on)
    ///
    /// When SMTP_HOST is unset this is simply "not configured": Send returns false
    /// and the caller carries on, so local/demo runs keep working unchanged.
    /// Uses System.Net.Mail (in-box) so no new NuGet dependency is introduced.
    /// </summary>
    public static class EmailSender
    {
        private static string? Env(string key) => Environment.GetEnvironmentVariable(key);

        public static bool IsConfigured => !string.IsNullOrWhiteSpace(Env("SMTP_HOST"));

        /// <summary>Best-effort send. Never throws: a mail outage must not break signup/reset.</summary>
        public static bool Send(string to, string subject, string body)
        {
            if (!IsConfigured || string.IsNullOrWhiteSpace(to)) return false;
            try
            {
                var host = Env("SMTP_HOST");
                var port = int.TryParse(Env("SMTP_PORT"), out var parsed) ? parsed : 587;
                var user = Env("SMTP_USER");
                var pass = Env("SMTP_PASS");
                var from = Env("SMTP_FROM") ?? user ?? "no-reply@trainwise.app";
                var useSsl = !string.Equals(Env("SMTP_SSL"), "false", StringComparison.OrdinalIgnoreCase);

                using var client = new SmtpClient(host, port) { EnableSsl = useSsl };
                if (!string.IsNullOrWhiteSpace(user))
                {
                    client.UseDefaultCredentials = false;
                    client.Credentials = new NetworkCredential(user, pass);
                }

                using var message = new MailMessage(from, to, subject, body);
                client.Send(message);
                return true;
            }
            catch (Exception ex)
            {
                // Log only. The caller still succeeds so the code stays usable via
                // the dev-code path / a retry.
                Console.WriteLine($"[EmailSender] Failed to send to {to}: {ex.Message}");
                return false;
            }
        }

        public static bool SendCode(string to, string code, bool isReset)
        {
            var subject = isReset ? "Your TrainWise password reset code" : "Verify your TrainWise email";
            var what = isReset
                ? "reset your TrainWise password"
                : "verify your TrainWise email address";
            var body =
                $"Hi,\n\nUse this code to {what}:\n\n    {code}\n\n" +
                $"The code expires in {(isReset ? "15" : "60")} minutes and can only be used once.\n\n" +
                "If you did not request this, you can safely ignore this email.\n\n- TrainWise";
            return Send(to, subject, body);
        }
    }
}
