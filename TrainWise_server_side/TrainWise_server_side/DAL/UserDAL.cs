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
                   {"@FullName", u.FullName},
                    {"@BirthYear", u.BirthYear},
                    {"@Gender", u.Gender},
                    {"@Height", u.Height},
                    {"@Weight", u.Weight},
                    {"@ActivityLevel", u.ActivityLevel},
                    {"@DeviceType", u.DeviceType},
                    {"@UserName", u.UserName},
                    {"@Email", u.Email},
                    {"@Password", u.Password},
                    {"@ExperienceLevel", u.ExperienceLevel},
                    {"@HealthDeclaration", u.HealthDeclaration},
                    {"@ConfirmTerms", u.ConfirmTerms},
                    {"@TermConfirmationDate", u.TermConfirmationDate ?? (object)DBNull.Value},
                    {"@IsCoach", u.IsCoach}
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
                    {"@FullName", u.FullName},
                    {"@BirthYear", u.BirthYear},
                    {"@Gender", u.Gender},
                    {"@Height", u.Height},
                    {"@Weight", u.Weight},
                    {"@ActivityLevel", u.ActivityLevel},
                    {"@DeviceType", u.DeviceType},
                    {"@UserName", (object?)u.UserName ?? DBNull.Value},
                    {"@Email", (object?)u.Email ?? DBNull.Value},
                    {"@ExperienceLevel", u.ExperienceLevel},
                    {"@HealthDeclaration", u.HealthDeclaration},
                    {"@ConfirmTerms", u.ConfirmTerms},
                    {"@TermConfirmationDate", u.TermConfirmationDate ?? (object)DBNull.Value}
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

        public User? GetUserById(int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetUserByID", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                        return MapUser(reader);
                }
            }
            return null;
        }

        public List<User> GetAllUsers()
        {
            var list = new List<User>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetAllUsers", con, null))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                    list.Add(MapUser(reader));
            }
            return list;
        }

        public User? LoginUser(string email, string password)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@Email", email},
                    {"@Password", password}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_LoginUser", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                        return MapUser(reader);
                }
            }
            return null;
        }
        public void UpdateUserBaseline(int userId, short dailyLoad, short weeklyLoad)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", userId},
                    {"@BaseLineDailyLoad", dailyLoad},
                    {"@BaseLineWeeklyLoad", weeklyLoad}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpdateUserBaseline", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
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

        public UserSummary? GetUserSummary(int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetUserSummary", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        return new UserSummary
                        {
                            UserID = (int)reader["UserID"],
                            FullName = reader["FullName"].ToString(),
                            DeviceType = reader["DeviceType"].ToString(),
                            LoadLevel = reader["LoadLevel"].ToString(),
                            StressScore = reader["StressScore"] as int? ?? 0,
                            LastLoadDate = reader["LastLoadDate"] as DateTime?
                        };
                    }
                }
            }
            return null;
        }

        private User MapUser(SqlDataReader reader)
        {
            return new User
            {
                UserID = (int)reader["UserID"],
                FullName = reader["FullName"].ToString(),
                BirthYear = Convert.ToInt32(reader["BirthYear"]),
                Gender = reader["Gender"].ToString(),
                Height = Convert.ToInt32(reader["Height"]),
                Weight = Convert.ToInt32(reader["Weight"]),
                ActivityLevel = Convert.ToInt32(reader["ActivityLevel"]),
                CreatedAt = reader["CreatedAt"] as DateTime? ?? default,
                DeviceType = reader["DeviceType"].ToString(),
                ProfileImagePath = reader["ProfileImagePath"] as string,
                UserName = reader["UserName"].ToString(),
                Email = reader["Email"].ToString(),
                ExperienceLevel = reader["ExperienceLevel"] as byte? ?? 1,
                BaseLineDailyLoad = reader["BaseLineDailyLoad"] as short? ?? 0,
                BaseLineWeeklyLoad = reader["BaseLineWeeklyLoad"] as short? ?? 0,
                IsBaselineEstablished = reader["IsBaselineEstablished"] as bool? ?? false,
                BaselineEstablishedDate = reader["BaselineEstablishedDate"] as DateTime?,
                HealthDeclaration = reader["HealthDeclaration"] as bool? ?? false,
                ConfirmTerms = reader["ConfirmTerms"] as bool? ?? false,
                TermConfirmationDate = reader["TermConfirmationDate"] as DateTime?,
                IsCoach = reader["IsCoach"] as bool? ?? false
            };
        }
    }
}