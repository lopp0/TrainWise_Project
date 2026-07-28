using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace TrainWise.BL
{
    /// <summary>
    /// Sends the transactional emails for #110 (password reset) and #114 (email
    /// verification) through Maileroo's HTTP sending API.
    ///
    /// Ported from Dana's Maileroo integration and adapted to this codebase:
    ///   - static + SYNCHRONOUS (HttpClient.Send) so it is a drop-in replacement
    ///     for the old EmailSender.SendCode calls in AuthRecoveryBL — no async
    ///     ripple into AuthController.
    ///   - best-effort like EmailSender: a mail outage must NEVER break the
    ///     signup / reset flow, so SendCode swallows failures and returns false.
    ///
    /// SECRET HANDLING (see the "never commit API keys" rule in CLAUDE.md):
    ///   Maileroo:ApiKey is NEVER committed. It is read from .NET user-secrets
    ///   locally (dotnet user-secrets set "Maileroo:ApiKey" ...) and from the
    ///   environment / Azure App Service settings in production (as the env var
    ///   Maileroo__ApiKey). Only the non-secret FromAddress / FromName live in
    ///   appsettings.json. When the key is absent this is simply "not configured":
    ///   SendCode returns false and the caller carries on (the AUTH_DEV_CODES
    ///   escape hatch still echoes the code back for local testing).
    /// </summary>
    public static class EmailService
    {
        private static readonly HttpClient _http = new HttpClient
        {
            BaseAddress = new Uri("https://smtp.maileroo.com/")
        };

        // Built once. appsettings.json only holds non-secret defaults; the API key
        // comes from user-secrets locally and from the environment in prod.
        private static readonly IConfiguration _config = LoadConfig();

        private static IConfiguration LoadConfig()
        {
            string env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";

            var builder = new ConfigurationBuilder()
                .AddJsonFile("appsettings.json", optional: true)
                .AddJsonFile($"appsettings.{env}.json", optional: true)
                .AddEnvironmentVariables();

            // User-secrets exist only in local dev; optional:true so a missing
            // UserSecretsId never throws (prod pulls the key from env vars instead).
            builder.AddUserSecrets(Assembly.GetExecutingAssembly(), optional: true);

            return builder.Build();
        }

        public static bool IsConfigured =>
            !string.IsNullOrWhiteSpace(_config["Maileroo:ApiKey"]);

        /// <summary>
        /// Best-effort send of a 6-digit reset/verify code. Never throws.
        /// Signature mirrors the old EmailSender.SendCode so callers are unchanged.
        /// </summary>
        public static bool SendCode(string to, string code, bool isReset)
        {
            string? apiKey = _config["Maileroo:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(to))
                return false;

            string fromAddress = _config["Maileroo:FromAddress"] ?? "noreply@trainwiseapp.maileroo.app";
            string fromName = _config["Maileroo:FromName"] ?? "TrainWise";

            string subject = isReset
                ? "Your TrainWise password reset code"
                : "Verify your TrainWise email";
            string minutes = isReset ? "15" : "60";
            string what = isReset
                ? "reset your TrainWise password"
                : "verify your TrainWise email address";

            var payload = new
            {
                from = new { address = fromAddress, display_name = fromName },
                to = new[] { new { address = to } },
                subject,
                plain = $"Use this code to {what}: {code}. It expires in {minutes} minutes. " +
                        "If you didn't request this, you can safely ignore this email.",
                html = $"<p>Use this code to {what}: <strong>{code}</strong>.</p>" +
                       $"<p>It expires in {minutes} minutes. If you didn't request this, you can safely ignore this email.</p>"
            };

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, "api/v2/emails");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                request.Content = new StringContent(
                    JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                using HttpResponseMessage response = _http.Send(request);
                if (!response.IsSuccessStatusCode)
                {
                    // Log status only; caller still succeeds so the code stays
                    // usable via the dev-code path / a retry.
                    Console.WriteLine($"[EmailService] Maileroo send failed ({(int)response.StatusCode}) to {to}");
                    return false;
                }
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EmailService] Failed to send to {to}: {ex.Message}");
                return false;
            }
        }
    }
}
