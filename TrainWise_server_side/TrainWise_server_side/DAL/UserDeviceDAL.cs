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
