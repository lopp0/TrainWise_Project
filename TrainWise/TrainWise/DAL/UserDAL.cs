using Microsoft.Data.SqlClient;
using TrainWise.BL;
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
                    {"@IsCoach", u.IsCoach},
                    {"@IsTrainee", u.IsTrainee}
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

        // Look up a user by email WITHOUT comparing the password in SQL. Password
        // verification now happens in C# (PasswordHasher) so hashes never have to
        // round-trip through a stored proc that does a plaintext `=` comparison.
        // Returns the full row (MapUser does not populate Password, so callers that
        // need the stored hash use GetStoredPasswordHash below).
        public User? GetUserByEmail(string email)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand("SELECT * FROM Users WHERE Email = @Email", con);
            cmd.Parameters.AddWithValue("@Email", email);
            using SqlDataReader reader = cmd.ExecuteReader();
            if (reader.Read())
                return MapUser(reader);
            return null;
        }

        // The stored password value (hash or legacy plaintext) for verification.
        public string? GetStoredPasswordHash(int userId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand("SELECT Password FROM Users WHERE UserID = @u", con);
            cmd.Parameters.AddWithValue("@u", userId);
            var v = cmd.ExecuteScalar();
            return v == null || v == DBNull.Value ? null : v.ToString();
        }

        // Persist a (re-)hashed password. Used at signup, change-password, and the
        // verify-and-upgrade path when a legacy plaintext row logs in successfully.
        public void SetPasswordHash(int userId, string hash)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand("UPDATE Users SET Password = @p WHERE UserID = @u", con);
            cmd.Parameters.AddWithValue("@u", userId);
            cmd.Parameters.AddWithValue("@p", hash);
            cmd.ExecuteNonQuery();
        }

        public User? LoginOrCreateGoogleUser(string googleId, string email, string fullName)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
        {
            {"@GoogleId", googleId},
            {"@Email",    email},
            {"@FullName", fullName}
        };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_LoginOrCreateGoogleUser", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                        return MapUser(reader);
                }
            }
            return null;
        }

        // Lookup used to block a Google *sign-up* when the Google account already
        // exists (inline SQL — no new stored proc, since the Azure DB schema is
        // managed separately). Returns null when no user has this GoogleId.
        public User? GetUserByGoogleId(string googleId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand("SELECT * FROM Users WHERE GoogleId = @GoogleId", con);
            cmd.Parameters.AddWithValue("@GoogleId", googleId);
            using SqlDataReader reader = cmd.ExecuteReader();
            if (reader.Read())
                return MapUser(reader);
            return null;
        }



        // #131 — body-measurement tracking (weight / body-fat over time). Inline
        // SQL against the BodyMeasurements table.
        public int InsertBodyMeasurement(int userId, double weight, double? bodyFat, DateTime date)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.BodyMeasurements (UserID, MeasuredAt, Weight, BodyFat)
VALUES (@u, @d, @w, @bf);
SELECT SCOPE_IDENTITY();", con);
            cmd.Parameters.AddWithValue("@u", userId);
            cmd.Parameters.AddWithValue("@d", date);
            cmd.Parameters.AddWithValue("@w", weight);
            cmd.Parameters.AddWithValue("@bf", (object?)bodyFat ?? DBNull.Value);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public List<BodyMeasurement> GetBodyMeasurements(int userId)
        {
            var list = new List<BodyMeasurement>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT MeasurementID, UserID, MeasuredAt, Weight, BodyFat
FROM dbo.BodyMeasurements WHERE UserID = @u ORDER BY MeasuredAt ASC;", con);
            cmd.Parameters.AddWithValue("@u", userId);
            using var r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new BodyMeasurement
                {
                    MeasurementID = Convert.ToInt32(r["MeasurementID"]),
                    UserID = Convert.ToInt32(r["UserID"]),
                    MeasuredAt = (DateTime)r["MeasuredAt"],
                    Weight = Convert.ToDouble(r["Weight"]),
                    BodyFat = r["BodyFat"] == DBNull.Value ? (double?)null : Convert.ToDouble(r["BodyFat"])
                });
            return list;
        }

        // #111 — verify the current password then set a new one (inline SQL,
        // plaintext to match the existing auth; hashing is the #167 hardening
        // item). Returns false when the current password doesn't match or the
        // account has no password (e.g. Google-only).
        public bool ChangePassword(int userId, string currentPassword, string newPassword)
        {
            using SqlConnection con = Connect();
            string? stored;
            using (SqlCommand check = new SqlCommand("SELECT Password FROM Users WHERE UserID = @u", con))
            {
                check.Parameters.AddWithValue("@u", userId);
                var v = check.ExecuteScalar();
                if (v == null || v == DBNull.Value) return false;   // e.g. Google-only account
                stored = v.ToString();
            }
            // Verify the current password (handles both PBKDF2 hashes and legacy plaintext).
            if (!PasswordHasher.Verify(currentPassword, stored))
                return false;

            using (SqlCommand upd = new SqlCommand("UPDATE Users SET Password = @p WHERE UserID = @u", con))
            {
                upd.Parameters.AddWithValue("@u", userId);
                upd.Parameters.AddWithValue("@p", PasswordHasher.Hash(newPassword));   // always store hashed
                upd.ExecuteNonQuery();
            }
            return true;
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

        private static bool HasColumn(SqlDataReader reader, string columnName)
        {
            for (int i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            return false;
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
                IsCoach = reader["IsCoach"] as bool? ?? false,
                GoogleId = HasColumn(reader, "GoogleId") ? reader["GoogleId"] as string : null,
                IsTrainee = SafeReadBool(reader, "IsTrainee", true),
                EquippedBadge = HasColumn(reader, "EquippedBadge") ? reader["EquippedBadge"] as string : null,
                EquippedTitle = HasColumn(reader, "EquippedTitle") ? reader["EquippedTitle"] as string : null,
                EquippedFrame = HasColumn(reader, "EquippedFrame") ? reader["EquippedFrame"] as string : null
            };
        }

        // Item 12 — store / read the device's Expo push token for remote push.
        public void SetPushToken(int userId, string? token)
        {
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = new SqlCommand(
                "UPDATE dbo.Users SET PushToken = @t WHERE UserID = @u", con))
            {
                cmd.Parameters.AddWithValue("@u", userId);
                cmd.Parameters.AddWithValue("@t", (object?)token ?? DBNull.Value);
                cmd.ExecuteNonQuery();
            }
        }

        public string? GetPushToken(int userId)
        {
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = new SqlCommand(
                "SELECT PushToken FROM dbo.Users WHERE UserID = @u", con))
            {
                cmd.Parameters.AddWithValue("@u", userId);
                var v = cmd.ExecuteScalar();
                return v == null || v == DBNull.Value ? null : v.ToString();
            }
        }

        // A-1: persist a user's equipped cosmetics (any may be null = none).
        public void UpdateEquippedItems(int userId, string? badge, string? title, string? frame)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", userId},
                    {"@EquippedBadge", (object?)badge ?? DBNull.Value},
                    {"@EquippedTitle", (object?)title ?? DBNull.Value},
                    {"@EquippedFrame", (object?)frame ?? DBNull.Value}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpdateEquippedItems", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        // A-1: batch cosmetics for a CSV of user ids (drives UserProfileCard in Connect).
        public List<UserCosmetics> GetCosmeticsForUsers(string idsCsv)
        {
            var list = new List<UserCosmetics>();
            if (string.IsNullOrWhiteSpace(idsCsv)) return list;
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = new SqlCommand(
                "SELECT UserID, EquippedBadge, EquippedTitle, EquippedFrame FROM dbo.Users " +
                "WHERE UserID IN (SELECT TRY_CONVERT(INT, value) FROM STRING_SPLIT(@ids, ','))", con))
            {
                cmd.Parameters.AddWithValue("@ids", idsCsv);
                using (var r = cmd.ExecuteReader())
                    while (r.Read())
                        list.Add(new UserCosmetics
                        {
                            UserID = (int)r["UserID"],
                            EquippedBadge = r["EquippedBadge"] as string,
                            EquippedTitle = r["EquippedTitle"] as string,
                            EquippedFrame = r["EquippedFrame"] as string
                        });
            }
            return list;
        }

        private static bool SafeReadBool(SqlDataReader reader, string column, bool fallback)
        {
            try
            {
                int ord = reader.GetOrdinal(column);
                return reader.IsDBNull(ord) ? fallback : reader.GetBoolean(ord);
            }
            catch (IndexOutOfRangeException)
            {
                return fallback;
            }
        }
    }
}


