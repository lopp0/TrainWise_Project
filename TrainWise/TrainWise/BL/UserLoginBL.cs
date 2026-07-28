using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class UserLoginBL
    {
        private readonly UserDAL _userDal = new UserDAL();

        public User Login(string email, string password)
        {
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email is required");

            if (string.IsNullOrWhiteSpace(password))
                throw new ArgumentException("Password is required");

            // Fetch by email, then verify the password in C# so hashes never have
            // to be compared inside a stored proc. Use the SAME generic failure
            // message whether the email is unknown or the password is wrong, so an
            // attacker can't enumerate which emails are registered.
            User? user = _userDal.GetUserByEmail(email);
            string? stored = user == null ? null : _userDal.GetStoredPasswordHash(user.UserID);

            // ALWAYS run a full PBKDF2 verification (against a dummy hash when the
            // account/hash is absent) so the response time doesn't reveal whether
            // the email exists — closes the login timing side channel.
            bool ok = PasswordHasher.Verify(password, stored ?? PasswordHasher.DummyHash);
            if (user == null || !ok)
                throw new UnauthorizedAccessException("Invalid email or password");

            // Verify-and-upgrade: transparently migrate legacy plaintext / weaker
            // hashes to the current PBKDF2 format on a successful sign-in.
            if (PasswordHasher.NeedsUpgrade(stored))
            {
                try { _userDal.SetPasswordHash(user.UserID, PasswordHasher.Hash(password)); }
                catch { /* upgrade is best-effort; never fail a valid login over it */ }
            }

            return user;
        }
    }
}
