using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace TrainWise.BL
{
    public class EmailService
    {
        private static readonly HttpClient _http = new HttpClient
        {
            BaseAddress = new Uri("https://smtp.maileroo.com/")
        };

        private readonly IConfiguration _config;

        public EmailService()
        {
            _config = LoadConfig();
        }

        // appsettings.json only holds non-secret defaults; the API key comes from
        // user-secrets locally and from the environment (App Service settings) in prod.
        private static IConfiguration LoadConfig()
        {
            string env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";

            var builder = new ConfigurationBuilder()
                .AddJsonFile("appsettings.json", optional: true)
                .AddJsonFile($"appsettings.{env}.json", optional: true)
                .AddEnvironmentVariables();

            if (env == "Development")
                builder.AddUserSecrets<Program>();

            return builder.Build();
        }

        public async Task SendPasswordResetCodeAsync(string toEmail, string code)
        {
            string apiKey = _config["Maileroo:ApiKey"]
                ?? throw new InvalidOperationException("Maileroo:ApiKey is not configured.");
            string fromAddress = _config["Maileroo:FromAddress"] ?? "noreply@trainwise.app";
            string fromName = _config["Maileroo:FromName"] ?? "TrainWise";

            var payload = new
            {
                from = new { address = fromAddress, display_name = fromName },
                to = new[] { new { address = toEmail } },
                subject = "Your TrainWise password reset code",
                plain = $"Your TrainWise password reset code is {code}. It expires in 10 minutes. " +
                        "If you didn't request this, you can safely ignore this email.",
                html = $"<p>Your TrainWise password reset code is <strong>{code}</strong>.</p>" +
                       "<p>It expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>"
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "api/v2/emails");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            using HttpResponseMessage response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                string body = await response.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"Maileroo send failed ({(int)response.StatusCode}): {body}");
            }
        }
    }
}
