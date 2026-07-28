using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    public class UserDeviceDAL : DBservice
    {
        public int Insert(UserDevice d)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", d.UserID},
                    {"@DeviceName", d.DeviceName},
                    {"@LastSync", d.LastSync},
                    {"@PermissionsGranted", d.PermissionsGranted}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InsertUserDevice", con, param))
                {
                    object id = cmd.ExecuteScalar();
                    return Convert.ToInt32(id);
                }
            }
        }

        public void Update(UserDevice d)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@DeviceID", d.DeviceID},
                    {"@LastSync", d.LastSync},
                    {"@PermissionsGranted", d.PermissionsGranted}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpdateUserDevice", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        // #163 — revoke (delete) a device/session. Scoped to the owner so a
        // caller can't remove another user's device row.
        public void Delete(int userId, int deviceId)
        {
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = new SqlCommand(
                "DELETE FROM dbo.UserDevices WHERE DeviceID = @d AND UserID = @u", con))
            {
                cmd.Parameters.AddWithValue("@d", deviceId);
                cmd.Parameters.AddWithValue("@u", userId);
                cmd.ExecuteNonQuery();
            }
        }

        public List<UserDevice> GetByUser(int userId)
        {
            var list = new List<UserDevice>();
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetUserDevices", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new UserDevice
                        {
                            DeviceID = (int)reader["DeviceID"],
                            UserID = (int)reader["UserID"],
                            DeviceName = reader["DeviceName"].ToString(),
                            LastSync = reader["LastSync"] as DateTime? ?? default,
                            PermissionsGranted = (bool)reader["PermissionsGranted"]
                        });
                    }
                }
            }
            return list;
        }
    }
}
