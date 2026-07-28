using System.Text.Json.Serialization;

namespace TrainWise.BL
{
    /// <summary>
    /// Server-side reCAPTCHA v2 verification against Google's siteverify API.
    ///
    /// The secret is read from the RECAPTCHA_SECRET environment variable
    /// (Azure App Service -> Configuration -> Application settings), NEVER from
    /// a hardcoded literal — same rule as FIREBASE_CREDENTIALS_JSON / the Google
    /// Maps key (see CLAUDE.md "API keys / secrets").
    ///
    /// Fail-open by design: if RECAPTCHA_SECRET is not set, verification is
    /// SKIPPED (returns true) so sign-up keeps working. Only set the env var to
    /// the REAL secret once the front-end uses the REAL site key that PAIRS with
    /// it — the universal TEST site key (6LeIxAcT...) does NOT validate against a
    /// real secret, so enabling this while the app sends test-key tokens would
    /// 400 every sign-up.
    /// </summary>
    public static class CaptchaVerifier
    {
        // One shared HttpClient (creating per-call exhausts sockets).
        private static readonly HttpClient _http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(10)
        };

        private const string VerifyUrl = "https://www.google.com/recaptcha/api/siteverify";

        /// <summary>
        /// Returns true if the captcha is valid OR verification is disabled
        /// (no secret configured). Returns false only when a secret IS
        /// configured and Google reports the token as invalid/missing.
        /// </summary>
        public static async Task<bool> VerifyAsync(string? token)
        {
            string? secret = Environment.GetEnvironmentVariable("RECAPTCHA_SECRET");

            // Captcha disabled — let sign-up through (test-key / dev / not yet wired).
            if (string.IsNullOrWhiteSpace(secret))
                return true;

            // Secret configured but the client sent no token -> reject.
            if (string.IsNullOrWhiteSpace(token))
                return false;

            try
            {
                using var content = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("secret", secret),
                    new KeyValuePair<string, string>("response", token)
                });

                var resp = await _http.PostAsync(VerifyUrl, content);
                resp.EnsureSuccessStatusCode();

                var result = await resp.Content.ReadFromJsonAsync<RecaptchaResult>();
                return result?.Success == true;
            }
            catch (Exception ex)
            {
                // Network/Google outage: don't lock people out of sign-up over an
                // external dependency — log and allow (fail-open).
                Console.WriteLine($"[CaptchaVerifier] verification error, allowing sign-up: {ex.Message}");
                return true;
            }
        }

        private sealed class RecaptchaResult
        {
            [JsonPropertyName("success")]
            public bool Success { get; set; }

            [JsonPropertyName("hostname")]
            public string? Hostname { get; set; }

            [JsonPropertyName("error-codes")]
            public string[]? ErrorCodes { get; set; }
        }
    }
}
