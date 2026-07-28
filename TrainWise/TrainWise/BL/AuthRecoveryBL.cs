using System.Security.Cryptography;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // #110 forgot/reset password + #114 email verification.
    //
    // Codes are 6 random digits, stored HASHED (PBKDF2) and single-use with a
    // 15-minute TTL. The forgot flow never reveals whether the email exists — the
    // controller always returns the same message. When the AUTH_DEV_CODES env var
    // is "true" (demo/local only, no email provider wired), the generated code is
    // returned so the flow is testable without SMTP.
    public class AuthRecoveryBL
    {
        private readonly AuthRecoveryDAL _dal = new AuthRecoveryDAL();
        private readonly UserDAL _userDal = new UserDAL();

        public static bool DevCodesEnabled =>
            string.Equals(Environment.GetEnvironmentVariable("AUTH_DEV_CODES"), "true", StringComparison.OrdinalIgnoreCase);

        private static string NewCode()
        {
            // 000000-999999, uniform.
            int n = RandomNumberGenerator.GetInt32(0, 1_000_000);
            return n.ToString("D6");
        }

        // Returns the code when the email maps to a user (so the controller can
        // dispatch it / surface it in dev mode); null when there is no such user.
        // The controller MUST NOT differ its response based on this.
        public string? RequestPasswordReset(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return null;
            var addr = email.Trim();
            int uid = _dal.GetUserIdByEmail(addr);
            if (uid == 0) return null;
            string code = NewCode();
            _dal.CreateCode(uid, "reset", PasswordHasher.Hash(code), 15);
            // Actually deliver it via Maileroo. No-op (returns false) until the
            // Maileroo:ApiKey secret is configured; see EmailService. Before
            // 2026-07-19 nothing was sent at all, which is why reset codes never
            // arrived.
            EmailService.SendCode(addr, code, isReset: true);
            return code;
        }

        // Throws ArgumentException on a bad/expired code or unknown email.
        public void ConfirmPasswordReset(string email, string code, string newPassword)
        {
            if (!InputValidator.IsStrongPassword(newPassword))
                throw new ArgumentException(InputValidator.PasswordRuleMessage);
            int uid = _dal.GetUserIdByEmail((email ?? "").Trim());
            if (uid == 0) throw new ArgumentException("Invalid or expired code");
            var (id, hash) = _dal.GetActiveCode(uid, "reset");
            if (id == 0 || !PasswordHasher.Verify(code ?? "", hash))
                throw new ArgumentException("Invalid or expired code");
            _dal.MarkUsed(id);
            _userDal.SetPasswordHash(uid, PasswordHasher.Hash(newPassword));
        }

        // #114 — issue a verification code for the given (already-known) user and
        // email it to the address on their profile. Delivery is best-effort: it is
        // a no-op until the Maileroo:ApiKey secret is set (see EmailService), which
        // is exactly why verification emails never arrived before 2026-07-19.
        public string RequestEmailVerification(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            string code = NewCode();
            _dal.CreateCode(userId, "verify", PasswordHasher.Hash(code), 60);
            var address = _userDal.GetUserById(userId)?.Email;
            if (!string.IsNullOrWhiteSpace(address))
                EmailService.SendCode(address, code, isReset: false);
            return code;
        }

        public void ConfirmEmailVerification(int userId, string code)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            var (id, hash) = _dal.GetActiveCode(userId, "verify");
            if (id == 0 || !PasswordHasher.Verify(code ?? "", hash))
                throw new ArgumentException("Invalid or expired code");
            _dal.MarkUsed(id);
            _dal.SetEmailVerified(userId);
        }
    }
}
