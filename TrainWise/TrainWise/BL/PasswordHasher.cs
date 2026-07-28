using System.Security.Cryptography;

namespace TrainWise.BL
{
    /// <summary>
    /// PBKDF2 password hashing (SHA-256, 100k iterations, per-password random salt).
    ///
    /// Uses only the .NET base class library — no extra NuGet package — so it works
    /// on a machine that can't restore packages. Stored format:
    ///     pbkdf2$&lt;iterations&gt;$&lt;base64-salt&gt;$&lt;base64-hash&gt;
    ///
    /// Backward compatibility: TrainWise historically stored passwords in PLAINTEXT
    /// (CHAR(8)). <see cref="Verify"/> transparently accepts a legacy plaintext value
    /// so existing accounts keep working, and <see cref="NeedsUpgrade"/> lets the
    /// login path re-hash them on the next successful sign-in (verify-and-upgrade).
    /// </summary>
    public static class PasswordHasher
    {
        private const int Iterations = 100_000;
        private const int SaltSize = 16;   // 128-bit salt
        private const int HashSize = 32;   // 256-bit derived key
        private const string Prefix = "pbkdf2";

        /// <summary>
        /// A valid PBKDF2 hash of a value no user has. The login path verifies
        /// against this when the email is unknown (or the account has no password),
        /// so an unknown email still pays the full PBKDF2 cost — otherwise the
        /// faster "no such user" path is a timing oracle for account enumeration.
        /// </summary>
        public static readonly string DummyHash = Hash(Guid.NewGuid().ToString("N"));

        /// <summary>Produce a salted PBKDF2 hash string for a new/updated password.</summary>
        public static string Hash(string password)
        {
            if (password == null) throw new ArgumentNullException(nameof(password));

            byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
            byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
                password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);

            return $"{Prefix}${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
        }

        /// <summary>True if the stored value is one of our PBKDF2 hashes (not legacy plaintext).</summary>
        public static bool IsHashed(string? stored) =>
            !string.IsNullOrEmpty(stored) && stored.StartsWith(Prefix + "$", StringComparison.Ordinal);

        /// <summary>
        /// Verify a candidate password against the stored value. Handles both the
        /// PBKDF2 format and legacy plaintext (CHAR(8) columns pad with spaces, so
        /// the legacy branch trims before comparing). Constant-time hash compare.
        /// </summary>
        public static bool Verify(string password, string? stored)
        {
            if (string.IsNullOrEmpty(stored) || password == null)
                return false;

            if (!IsHashed(stored))
            {
                // Legacy plaintext row. CHAR(8) right-pads with spaces.
                return FixedTimeEquals(stored.TrimEnd(), password);
            }

            var parts = stored.Split('$');
            if (parts.Length != 4) return false;
            if (!int.TryParse(parts[1], out int iterations) || iterations <= 0) return false;

            byte[] salt, expected;
            try
            {
                salt = Convert.FromBase64String(parts[2]);
                expected = Convert.FromBase64String(parts[3]);
            }
            catch (FormatException) { return false; }

            byte[] actual = Rfc2898DeriveBytes.Pbkdf2(
                password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);

            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }

        /// <summary>
        /// True when a stored value verified successfully but is NOT in the current
        /// hash format (legacy plaintext, or a weaker/old parameter set) and should
        /// be re-hashed and persisted after a successful login.
        /// </summary>
        public static bool NeedsUpgrade(string? stored)
        {
            if (!IsHashed(stored)) return true;                       // legacy plaintext
            var parts = stored!.Split('$');
            return parts.Length != 4
                || !int.TryParse(parts[1], out int it)
                || it < Iterations;                                   // weaker cost factor
        }

        private static bool FixedTimeEquals(string a, string b)
        {
            // Compare as UTF-8 bytes in constant time to avoid an early-exit timing
            // side channel on the legacy plaintext path.
            byte[] ba = System.Text.Encoding.UTF8.GetBytes(a);
            byte[] bb = System.Text.Encoding.UTF8.GetBytes(b);
            return CryptographicOperations.FixedTimeEquals(ba, bb);
        }
    }
}
