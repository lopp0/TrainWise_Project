using System.Text.Json.Serialization;

namespace TrainWise.BL
{
    /// <summary>
    /// Verifies a Google Sign-In ID token server-side via Google's tokeninfo
    /// endpoint (which validates the signature + expiry for us), then checks the
    /// audience matches OUR web client ID so a token minted for some other app
    /// can't be replayed here.
    ///
    /// The expected audience is the Firebase project's WEB client ID. It is PUBLIC
    /// (it ships inside the APK), so the fallback literal is not a secret; it can
    /// still be overridden via the GOOGLE_WEB_CLIENT_ID env var (Azure config).
    /// </summary>
    public static class GoogleTokenVerifier
    {
        private static readonly HttpClient _http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(10)
        };

        private const string TokenInfoUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=";

        // Web client ID of Firebase project trainwise-ef6aa (public).
        private const string DefaultWebClientId =
            "388904145749-9fg97kftfjbuaarj0oma1poi88ok2h2j.apps.googleusercontent.com";

        private static string ExpectedAudience =>
            Environment.GetEnvironmentVariable("GOOGLE_WEB_CLIENT_ID") ?? DefaultWebClientId;

        /// <summary>
        /// Returns the verified Google identity, or null if the token is invalid,
        /// expired, the email isn't verified, or it was issued for another app.
        /// </summary>
        public static async Task<GoogleIdentity?> VerifyAsync(string? idToken)
        {
            if (string.IsNullOrWhiteSpace(idToken))
                return null;

            try
            {
                // Uri.EscapeDataString guards against a malformed token breaking the URL.
                var resp = await _http.GetAsync(TokenInfoUrl + Uri.EscapeDataString(idToken));
                if (!resp.IsSuccessStatusCode)
                    return null; // Google rejected the token (bad signature / expired).

                var info = await resp.Content.ReadFromJsonAsync<TokenInfo>();
                if (info == null || string.IsNullOrEmpty(info.Sub))
                    return null;

                // Must be a token minted for OUR client, not some other app's.
                if (!string.Equals(info.Aud, ExpectedAudience, StringComparison.Ordinal))
                {
                    Console.WriteLine($"[GoogleTokenVerifier] audience mismatch: {info.Aud}");
                    return null;
                }

                if (!string.Equals(info.EmailVerified, "true", StringComparison.OrdinalIgnoreCase))
                    return null;

                return new GoogleIdentity
                {
                    GoogleId = info.Sub,
                    Email = info.Email,
                    FullName = string.IsNullOrWhiteSpace(info.Name) ? info.Email : info.Name
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GoogleTokenVerifier] verification error: {ex.Message}");
                return null;
            }
        }

        private sealed class TokenInfo
        {
            [JsonPropertyName("sub")] public string Sub { get; set; } = "";
            [JsonPropertyName("aud")] public string Aud { get; set; } = "";
            [JsonPropertyName("email")] public string Email { get; set; } = "";
            [JsonPropertyName("email_verified")] public string EmailVerified { get; set; } = "";
            [JsonPropertyName("name")] public string? Name { get; set; }
        }
    }

    public sealed class GoogleIdentity
    {
        public string GoogleId { get; set; } = "";
        public string Email { get; set; } = "";
        public string FullName { get; set; } = "";
    }
}
