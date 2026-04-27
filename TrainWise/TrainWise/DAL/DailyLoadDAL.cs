using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;


namespace TrainWise.DAL
{
    public class DailyLoadDAL : DBservice
    {
        // Fetches last 28 days of confirmed sessions — C# will calculate load from this.
        // sp_GetActivityLogsForLoad signature: @UserID, @StartDate, @EndDate (StartTime < @EndDate).
        public List<ActivityLog> GetActivityLogsForLoad(int userId, DateTime date)
        {
            var list = new List<ActivityLog>();
            using (SqlConnection con = Connect())
            {
                var startDate = date.Date.AddDays(-27);
                var endDate = date.Date.AddDays(1);
                var param = new Dictionary<string, object>
                {
                    {"@UserID", userId},
                    {"@StartDate", startDate},
                    {"@EndDate", endDate}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetActivityLogsForLoad", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new ActivityLog
                        {
                            ActivityID = (int)reader["ActivityID"],
                            UserID = (int)reader["UserID"],
                            ActivityTypeID = (int)reader["ActivityTypeID"],
                            Duration = reader["Duration"] as short? ?? 0,
                            ExertionLevel = reader["ExertionLevel"] as byte? ?? 0,
                            CalculatedLoadForSession = reader["CalculatedLoadForSession"] as short? ?? 0,
                            StartTime = reader["StartTime"] as DateTime? ?? default,
                        });
                    }
                }
            }
            return list;
        }

        // Fetches user baseline + LoadParameters + HasActiveInjury in one call
        public UserLoadContext GetUserLoadContext(int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetUserLoadContext", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        return new UserLoadContext
                        {
                            IsBaselineEstablished = reader["IsBaselineEstablished"] as bool? ?? false,
                            BaseLineDailyLoad = reader["BaseLineDailyLoad"] as short? ?? 0,
                            ExperienceLevel = reader["ExperienceLevel"] as byte? ?? 1,
                            HasActiveInjury = reader["HasActiveInjury"] as bool? ?? false,
                            Parameters = new LoadParameters
                            {
                                BeginnerDailyLoad = reader["BeginnerDailyLoad"] as short? ?? 0,
                                RegularDailyLoad = reader["RegularDailyLoad"] as short? ?? 0,
                                AdvanceDailyLoad = reader["AdvanceDailyLoad"] as short? ?? 0,
                                BeginnerAcuteLoad = reader["BeginnerAcuteLoad"] as short? ?? 0,
                                RegularAcuteLoad = reader["RegularAcuteLoad"] as short? ?? 0,
                                AdvanceAcuteLoad = reader["AdvanceAcuteLoad"] as short? ?? 0,
                                LowLoadRatio = reader["LowLoadRatio"] as double? ?? 0,
                                SafeZoneLowRange = reader["SafeZoneLowRange"] as double? ?? 0.8,
                                SafeZoneHighRange = reader["SafeZoneHighRange"] as double? ?? 1.3,
                                OverLoad = reader["OverLoad"] as double? ?? 1.5
                            }
                        };
                    }
                }
            }
            return null;
        }

        // Saves the C#-calculated DailyLoad to DB
        public int SaveDailyLoad(DailyLoad dl)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", dl.UserID},
                    {"@Date", dl.Date},
                    {"@AcuteLoad", dl.AcuteLoad},
                    {"@ChronicLoad", dl.ChronicLoad},
                    {"@AC_Ratio", dl.AC_Ratio ?? (object)DBNull.Value},
                    {"@StressScore", dl.StressScore},
                    {"@LoadLevel", dl.LoadLevel}
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_SaveDailyLoad", con, param))
                {
                    object id = cmd.ExecuteScalar();
                    return Convert.ToInt32(id);
                }
            }
        }

        public List<DailyLoad> GetDailyLoadByUser(int userId)
        {
            var list = new List<DailyLoad>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetDailyLoadByUser", con, new Dictionary<string, object> { { "@UserID", userId } }))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    list.Add(new DailyLoad
                    {
                        LoadID = (int)reader["LoadID"],
                        UserID = (int)reader["UserID"],
                        Date = (DateTime)reader["Date"],
                        AcuteLoad = Convert.ToDouble(reader["AcuteLoad"]),
                        ChronicLoad = Convert.ToDouble(reader["ChronicLoad"]),
                        AC_Ratio = reader["AC_Ratio"] == DBNull.Value ? (double?)null : Convert.ToDouble(reader["AC_Ratio"]),
                        StressScore = Convert.ToInt32(reader["StressScore"]),
                        LoadLevel = reader["LoadLevel"].ToString()
                    });
                }
            }
            return list;
        }
    }
}
