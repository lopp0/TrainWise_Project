using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;


namespace TrainWise.DAL
{
    public class UserDAL : DBservice
    {
        public int InsertUser(User u)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@FullName", u.FullName },
                    {"@BirthYear", u.BirthYear },
                    {"@Gender", u.Gender },
                    {"@Height", u.Height },
                    {"@Weight", u.Weight },
                    {"@ActivityLevel", u.ActivityLevel },
                    {"@DeviceType", u.DeviceType }
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InsertUser", con, param))
                {
                    object result = cmd.ExecuteScalar();
                    return Convert.ToInt32(result);
                }
            }
        }

        public void UpdateUser(User u)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", u.UserID},
                    {"@FullName", u.FullName },
                    {"@BirthYear", u.BirthYear },
                    {"@Gender", u.Gender },
                    {"@Height", u.Height },
                    {"@Weight", u.Weight },
                    {"@ActivityLevel", u.ActivityLevel },
                    {"@DeviceType", u.DeviceType }
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpdateUser", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void DeleteUser(int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_DeleteUser", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public User GetUserById(int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetUserByID", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        return new User
                        {
                            UserID = (int)reader["UserID"],
                            FullName = reader["FullName"].ToString(),
                            BirthYear = reader["BirthYear"] as int? ?? 0,
                            Gender = reader["Gender"].ToString(),
                            Height = reader["Height"] as int? ?? 0,
                            Weight = reader["Weight"] as int? ?? 0,
                            ActivityLevel = reader["ActivityLevel"] as int? ?? 0,
                            CreatedAt = reader["CreatedAt"] as DateTime? ?? default,
                            DeviceType = reader["DeviceType"].ToString()
                        };
                    }
                }

                return null;
            }
        }

        public List<User> GetAllUsers()
        {
            var list = new List<User>();
            using (SqlConnection con = Connect())
            {
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetAllUsers", con, null))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new User
                        {
                            UserID = (int)reader["UserID"],
                            FullName = reader["FullName"].ToString(),
                            BirthYear = reader["BirthYear"] as int? ?? 0,
                            Gender = reader["Gender"].ToString(),
                            Height = reader["Height"] as int? ?? 0,
                            Weight = reader["Weight"] as int? ?? 0,
                            ActivityLevel = reader["ActivityLevel"] as int? ?? 0,
                            CreatedAt = reader["CreatedAt"] as DateTime? ?? default,
                            DeviceType = reader["DeviceType"].ToString()
                        });
                    }
                }
            }
            return list;
        }

        public void UpdateUserProfileImage(int userId, string profileImagePath)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", userId },
                    {"@ProfileImagePath", profileImagePath }
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpdateUserProfileImage", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}
