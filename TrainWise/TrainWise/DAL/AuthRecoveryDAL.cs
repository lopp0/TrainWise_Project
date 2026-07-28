using Microsoft.Data.SqlClient;

namespace TrainWise.DAL
{
    // #110/#114 — data access for password-reset + email-verification codes.
    public class AuthRecoveryDAL : DBservice
    {
        public int GetUserIdByEmail(string email)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@Email", email } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetUserIdByEmail", con, p);
            var o = cmd.ExecuteScalar();
            return o == null || o == DBNull.Value ? 0 : Convert.ToInt32(o);
        }

        public void CreateCode(int userId, string purpose, string codeHash, int minutes)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@UserID", userId }, { "@Purpose", purpose }, { "@CodeHash", codeHash }, { "@Minutes", minutes }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_CreateAuthCode", con, p);
            cmd.ExecuteScalar();
        }

        // Active (unused, unexpired) code row. (0, null) when none.
        public (int id, string hash) GetActiveCode(int userId, string purpose)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserID", userId }, { "@Purpose", purpose } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetActiveAuthCode", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            if (r.Read())
                return (Convert.ToInt32(r["AuthCodeId"]), r["CodeHash"]?.ToString());
            return (0, null);
        }

        public void MarkUsed(int authCodeId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@AuthCodeId", authCodeId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_MarkAuthCodeUsed", con, p);
            cmd.ExecuteNonQuery();
        }

        public void SetEmailVerified(int userId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserID", userId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_SetEmailVerified", con, p);
            cmd.ExecuteNonQuery();
        }
    }
}
