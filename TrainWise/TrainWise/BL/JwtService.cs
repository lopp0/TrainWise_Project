using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using TrainWise.BL.Models;

namespace TrainWise.BL
{
    /// <summary>
    /// Issues and describes the signed JWT that authenticates a TrainWise user.
    /// The token carries a verified identity (uid + role flags) so the API can
    /// stop trusting a client-supplied userId in the URL/body.
    ///
    /// Config (all via environment variables so no secret sits in source):
    ///   JWT_KEY       HMAC-SHA256 signing key (>= 32 chars). REQUIRED in prod.
    ///   JWT_ISSUER    token issuer   (default "TrainWise")
    ///   JWT_AUDIENCE  token audience (default "TrainWiseApp")
    ///   JWT_EXPIRY_DAYS  token lifetime in days (default 30 — long-lived because
    ///                    there is no refresh flow yet; documented trade-off)
    ///   AUTH_ENFORCE  "true" to REQUIRE a valid token on every non-anonymous
    ///                 endpoint. Default FALSE so existing (tokenless) app builds
    ///                 keep working during rollout; flip to true once the updated
    ///                 client is deployed and login is confirmed.
    /// </summary>
    public static class JwtService
    {
        public static string Issuer =>
            Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "TrainWise";

        public static string Audience =>
            Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "TrainWiseApp";

        public static bool Enforce =>
            string.Equals(Environment.GetEnvironmentVariable("AUTH_ENFORCE"), "true",
                StringComparison.OrdinalIgnoreCase);

        private static int ExpiryDays
        {
            get
            {
                var raw = Environment.GetEnvironmentVariable("JWT_EXPIRY_DAYS");
                return int.TryParse(raw, out var d) && d > 0 ? d : 30;
            }
        }

        // Resolved once per process. If JWT_KEY is unset/too short we generate a
        // random key at startup so local dev runs without config — but tokens then
        // invalidate on restart, so PROD MUST set a fixed JWT_KEY in Azure config.
        private static readonly byte[] _keyBytes = ResolveKey();

        private static byte[] ResolveKey()
        {
            var configured = Environment.GetEnvironmentVariable("JWT_KEY");
            if (!string.IsNullOrWhiteSpace(configured) && configured.Length >= 32)
                return Encoding.UTF8.GetBytes(configured);

            Console.WriteLine("[JwtService] JWT_KEY not set or too short (<32 chars) — " +
                "using a RANDOM per-process key. Tokens will not survive a restart. " +
                "Set JWT_KEY in Azure App Service config for production.");
            return RandomNumberGenerator.GetBytes(64);
        }

        public static SymmetricSecurityKey SigningKey => new SymmetricSecurityKey(_keyBytes);

        /// <summary>
        /// Create a signed JWT for a successfully authenticated user.
        ///
        /// <paramref name="sessionId"/> (2026-07-19) is the dbo.UserSessions row for
        /// this device login. It rides along as the "sid" claim so Program.cs can
        /// reject the token the moment that session is revoked from
        /// Settings → Devices &amp; sessions. Pass 0 to mint a session-less token
        /// (legacy paths); those are accepted but cannot be remotely revoked.
        /// </summary>
        public static string CreateToken(User u, int sessionId = 0, string tokenId = null)
        {
            var creds = new SigningCredentials(SigningKey, SecurityAlgorithms.HmacSha256);
            var claims = new List<Claim>
            {
                // "uid" is read directly by BaseApiController — deterministic
                // regardless of how the framework maps the standard "sub" claim.
                new Claim("uid", u.UserID.ToString()),
                new Claim(JwtRegisteredClaimNames.Sub, u.UserID.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, tokenId ?? Guid.NewGuid().ToString("N")),
                new Claim("isCoach", u.IsCoach ? "1" : "0"),
                new Claim("isTrainee", u.IsTrainee ? "1" : "0"),
            };
            if (sessionId > 0) claims.Add(new Claim("sid", sessionId.ToString()));
            if (!string.IsNullOrEmpty(u.Email)) claims.Add(new Claim(JwtRegisteredClaimNames.Email, u.Email));
            if (!string.IsNullOrEmpty(u.FullName)) claims.Add(new Claim("name", u.FullName));

            var token = new JwtSecurityToken(
                issuer: Issuer,
                audience: Audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddDays(ExpiryDays),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
