using System.Security.Cryptography;
using System.Text;
using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class PasswordResetBL
    {
        private const int CodeLifetimeMinutes = 10;
        private const int MaxAttempts = 5;

        private readonly PasswordResetDAL _dal = new PasswordResetDAL();
        private readonly EmailService _email = new EmailService();

        // Always succeeds from the caller's point of view (even for unknown emails)
        // so the endpoint can't be used to enumerate registered accounts.
        public async Task RequestReset(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email is required");

            int? userId = _dal.GetUserIDByEmail(email);
            if (userId == null)
                return;

            string code = GenerateCode();
            string codeHash = Hash(code);

            _dal.InvalidateOutstandingCodes(userId.Value);
            _dal.InsertCode(userId.Value, codeHash, DateTime.UtcNow.AddMinutes(CodeLifetimeMinutes));

            await _email.SendPasswordResetCodeAsync(email, code);
        }

        public void VerifyCode(string email, string code)
        {
            GetValidatedCode(email, code);
        }

        public void ResetPassword(string email, string code, string newPassword)
        {
            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 4)
                throw new ArgumentException("Password must have minimum 4 characters");

            PasswordResetCode resetCode = GetValidatedCode(email, code);

            int userId = resetCode.UserID;
            _dal.UpdatePassword(userId, newPassword);
            _dal.MarkUsed(resetCode.ResetID);
        }

        // Shared by verify + reset so both endpoints enforce the same expiry/attempt rules
        // against the same underlying row.
        private PasswordResetCode GetValidatedCode(string email, string code)
        {
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email is required");
            if (string.IsNullOrWhiteSpace(code))
                throw new ArgumentException("Code is required");

            int? userId = _dal.GetUserIDByEmail(email);
            if (userId == null)
                throw new UnauthorizedAccessException("Invalid or expired code");

            PasswordResetCode? resetCode = _dal.GetLatestCode(userId.Value);
            if (resetCode == null || resetCode.ExpiresAt < DateTime.UtcNow)
                throw new UnauthorizedAccessException("Invalid or expired code");

            if (resetCode.Attempts >= MaxAttempts)
                throw new UnauthorizedAccessException("Too many attempts. Request a new code.");

            if (resetCode.CodeHash != Hash(code))
            {
                _dal.IncrementAttempts(resetCode.ResetID);
                throw new UnauthorizedAccessException("Invalid or expired code");
            }

            return resetCode;
        }

        private static string GenerateCode()
        {
            return RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        }

        private static string Hash(string code)
        {
            byte[] bytes = SHA256.HashData(Encoding.UTF8.GetBytes(code));
            return Convert.ToHexString(bytes);
        }
    }
}
