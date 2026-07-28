using System.Text.RegularExpressions;

namespace TrainWise.BL
{
    // Server-side email + password validation. Mirrors the client rules
    // (TrainWiseExpo/src/utils/validation.js) so the two never drift — client
    // validation is UX only; this is the real gate.
    public static class InputValidator
    {
        private static readonly Regex EmailRe =
            new Regex(@"^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$", RegexOptions.Compiled);

        public static bool IsValidEmail(string? email)
        {
            if (string.IsNullOrWhiteSpace(email)) return false;
            var e = email.Trim();
            if (e.Length > 254 || e.Contains("..")) return false;
            if (!EmailRe.IsMatch(e)) return false;
            var parts = e.Split('@');
            if (parts.Length != 2) return false;
            var local = parts[0];
            var domain = parts[1];
            if (local.Length == 0 || local.Length > 64) return false;
            if (local.StartsWith(".") || local.EndsWith(".")) return false;
            if (domain.StartsWith("-") || domain.EndsWith("-")) return false;
            if (domain.StartsWith(".") || domain.EndsWith(".")) return false;
            return true;
        }

        // At least 8 chars, one uppercase, one lowercase, one digit.
        public static bool IsStrongPassword(string? password)
        {
            if (string.IsNullOrEmpty(password)) return false;
            if (password.Length < 8) return false;
            bool upper = false, lower = false, digit = false;
            foreach (var c in password)
            {
                if (char.IsUpper(c)) upper = true;
                else if (char.IsLower(c)) lower = true;
                else if (char.IsDigit(c)) digit = true;
            }
            return upper && lower && digit;
        }

        public const string PasswordRuleMessage =
            "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.";
    }
}
