using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;
using System;
using System.Collections.Generic;

namespace TrainWise.DAL
{
    public class ActivityLogDAL : DBservice
    {
        public int Insert(ActivityLog al)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", al.UserID},
                    {"@ActivityTypeID", al.ActivityTypeID},
                    {"@StartTime", al.StartTime},
                    {"@EndTime", al.EndTime},
                    {"@DistanceKM", al.DistanceKM},
                    {"@AvgHeartRate", al.AvgHeartRate},
                    {"@MaxHeartRate", al.MaxHeartRate},
                    {"@CaloriesBurned", al.CaloriesBurned},
                    {"@SourceDevice", al.SourceDevice}
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InsertActivityLog", con, param))
                {
                    object r = cmd.ExecuteScalar();
                    return Convert.ToInt32(r);
                }
            }
        }

        public void Update(ActivityLog al)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@ActivityID", al.ActivityID},
                    {"@StartTime", al.StartTime},
                    {"@EndTime", al.EndTime},
                    {"@DistanceKM", al.DistanceKM},
                    {"@AvgHeartRate", al.AvgHeartRate},
                    {"@MaxHeartRate", al.MaxHeartRate},
                    {"@CaloriesBurned", al.CaloriesBurned}
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpdateActivityLog", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void Delete(int activityId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@ActivityID", activityId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_DeleteActivityLog", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public List<ActivityLog> GetByUser(int userId)
        {
            var list = new List<ActivityLog>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetActivityLogsByUser", con, new Dictionary<string, object> { { "@UserID", userId } }))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    list.Add(new ActivityLog
                    {
                        ActivityID = (int)reader["ActivityID"],
                        UserID = (int)reader["UserID"],
                        ActivityTypeID = (int)reader["ActivityTypeID"],
                        StartTime = reader["StartTime"] as DateTime? ?? default,
                        EndTime = reader["EndTime"] as DateTime? ?? default,
                        DistanceKM = reader["DistanceKM"] as double? ?? 0,
                        AvgHeartRate = reader["AvgHeartRate"] as int? ?? 0,
                        MaxHeartRate = reader["MaxHeartRate"] as int? ?? 0,
                        CaloriesBurned = reader["CaloriesBurned"] as double? ?? 0,
                        SourceDevice = reader["SourceDevice"].ToString(),
                    });
                }
            }
            return list;
        }
    }
}
