using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    /// <summary>
    /// Server-side login-session registry (2026-07-19). One row per device login;
    /// the JWT carries the SessionId in its "sid" claim so a session can be
    /// revoked and that device's token stops working on the very next request.
    /// Requires sql/2026-07-19_add_user_sessions.sql.
    /// </summary>
    public class SessionDAL : DBservice
    {
        private static string Str(SqlDataReader r, string c) => r[c] == DBNull.Value ? null : r[c].ToString();
        private static int Int(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToInt32(r[c]);
        private static DateTime Dt(SqlDataReader r, string c) => r[c] == DBNull.Value ? default : Convert.ToDateTime(r[c]);

        public int CreateSession(int userId, string tokenId, string deviceName, string platform, string appVersion, string ip)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@UserId", userId },
                { "@TokenId", tokenId ?? "" },
                { "@DeviceName", (object)deviceName ?? DBNull.Value },
                { "@Platform", (object)platform ?? DBNull.Value },
                { "@AppVersion", (object)appVersion ?? DBNull.Value },
                { "@IpAddress", (object)ip ?? DBNull.Value }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_CreateUserSession", con, p);
            var o = cmd.ExecuteScalar();
            return o == null || o == DBNull.Value ? 0 : Convert.ToInt32(o);
        }

        public List<UserSession> GetSessions(int userId)
        {
            var list = new List<UserSession>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserId", userId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetUserSessions", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new UserSession
                {
                    SessionId = Int(r, "SessionId"),
                    UserId = Int(r, "UserId"),
                    DeviceName = Str(r, "DeviceName"),
                    Platform = Str(r, "Platform"),
                    AppVersion = Str(r, "AppVersion"),
                    CreatedAt = Dt(r, "CreatedAt"),
                    LastSeenAt = Dt(r, "LastSeenAt")
                });
            return list;
        }

        public bool IsSessionActive(int sessionId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@SessionId", sessionId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_IsSessionActive", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            return r.Read() && r["IsActive"] != DBNull.Value && Convert.ToBoolean(r["IsActive"]);
        }

        public void Touch(int sessionId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@SessionId", sessionId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_TouchUserSession", con, p);
            cmd.ExecuteNonQuery();
        }

        public int Revoke(int userId, int sessionId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserId", userId }, { "@SessionId", sessionId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_RevokeUserSession", con, p);
            var o = cmd.ExecuteScalar();
            return o == null || o == DBNull.Value ? 0 : Convert.ToInt32(o);
        }

        public int RevokeOthers(int userId, int keepSessionId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserId", userId }, { "@KeepSessionId", keepSessionId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_RevokeOtherUserSessions", con, p);
            var o = cmd.ExecuteScalar();
            return o == null || o == DBNull.Value ? 0 : Convert.ToInt32(o);
        }
    }
}
