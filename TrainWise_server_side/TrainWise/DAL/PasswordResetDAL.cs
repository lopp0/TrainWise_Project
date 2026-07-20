using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    public class PasswordResetDAL : DBservice
    {
        public int? GetUserIDByEmail(string email)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@Email", email } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetUserIDByEmail", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                        return (int)reader["UserID"];
                }
            }
            return null;
        }

        public void InvalidateOutstandingCodes(int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InvalidatePasswordResetCodes", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public int InsertCode(int userId, string codeHash, DateTime expiresAt)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", userId},
                    {"@CodeHash", codeHash},
                    {"@ExpiresAt", expiresAt}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InsertPasswordResetCode", con, param))
                {
                    object id = cmd.ExecuteScalar();
                    return Convert.ToInt32(id);
                }
            }
        }

        public PasswordResetCode? GetLatestCode(int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetLatestPasswordResetCode", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        return new PasswordResetCode
                        {
                            ResetID = (int)reader["ResetID"],
                            UserID = (int)reader["UserID"],
                            CodeHash = reader["CodeHash"].ToString(),
                            ExpiresAt = (DateTime)reader["ExpiresAt"],
                            Attempts = (int)reader["Attempts"],
                            Used = (bool)reader["Used"],
                            CreatedAt = (DateTime)reader["CreatedAt"]
                        };
                    }
                }
            }
            return null;
        }

        public void IncrementAttempts(int resetId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@ResetID", resetId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_IncrementResetCodeAttempts", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void MarkUsed(int resetId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@ResetID", resetId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_MarkResetCodeUsed", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void UpdatePassword(int userId, string password)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", userId},
                    {"@Password", password}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpdateUserPassword", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}
