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
                    {"@AvgHeartRate", al.AvgHeartRate ?? (object)DBNull.Value},
                    {"@MaxHeartRate", al.MaxHeartRate ?? (object)DBNull.Value},
                    {"@CaloriesBurned", al.CaloriesBurned ?? (object)DBNull.Value},
                    {"@SourceDevice", al.SourceDevice},
                    {"@ExertionLevel", al.ExertionLevel},
                    {"@Duration", al.Duration},
                    {"@CalculatedLoadForSession", al.CalculatedLoadForSession},
                    {"@IsConfirmed", al.IsConfirmed}
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
                    {"@ActivityTypeID", al.ActivityTypeID},
                    {"@StartTime", al.StartTime},
                    {"@EndTime", al.EndTime},
                    {"@DistanceKM", al.DistanceKM},
                    {"@AvgHeartRate", al.AvgHeartRate ?? (object)DBNull.Value},
                    {"@MaxHeartRate", al.MaxHeartRate ?? (object)DBNull.Value},
                    {"@CaloriesBurned", al.CaloriesBurned ?? (object)DBNull.Value},
                    {"@SourceDevice", al.SourceDevice},
                    {"@ExertionLevel", al.ExertionLevel},
                    {"@Duration", al.Duration},
                    {"@CalculatedLoadForSession", al.CalculatedLoadForSession},
                    {"@IsConfirmed", al.IsConfirmed}
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpdateActivityLog", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        // #124 — set the optional note + photo on a workout (inline SQL so we
        // don't have to touch the insert/update stored procs). Returns the values
        // back so the client can confirm.
        public void SetNotesAndPhoto(int activityId, string? notes, string? photoPath)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "UPDATE dbo.ActivityLogs SET Notes = @n, PhotoPath = @p WHERE ActivityID = @id", con);
            cmd.Parameters.AddWithValue("@id", activityId);
            cmd.Parameters.AddWithValue("@n", (object?)notes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@p", (object?)photoPath ?? DBNull.Value);
            cmd.ExecuteNonQuery();
        }

        // #124 — read the note + photo for one workout.
        public (string? notes, string? photoPath) GetNotesAndPhoto(int activityId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "SELECT Notes, PhotoPath FROM dbo.ActivityLogs WHERE ActivityID = @id", con);
            cmd.Parameters.AddWithValue("@id", activityId);
            using var r = cmd.ExecuteReader();
            if (r.Read())
                return (r["Notes"] == DBNull.Value ? null : r["Notes"].ToString(),
                        r["PhotoPath"] == DBNull.Value ? null : r["PhotoPath"].ToString());
            return (null, null);
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

        // Owner of a workout row (for authorization). Null if it doesn't exist.
        public int? GetOwnerUserId(int activityId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "SELECT UserID FROM dbo.ActivityLogs WHERE ActivityID = @id", con);
            cmd.Parameters.AddWithValue("@id", activityId);
            var v = cmd.ExecuteScalar();
            return v == null || v == DBNull.Value ? (int?)null : Convert.ToInt32(v);
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
                        AvgHeartRate = reader["AvgHeartRate"] as int?,
                        MaxHeartRate = reader["MaxHeartRate"] as int?,
                        CaloriesBurned = reader["CaloriesBurned"] as double?,
                        SourceDevice = reader["SourceDevice"].ToString(),
                        ExertionLevel = reader["ExertionLevel"] as byte? ?? 0,
                        Duration = reader["Duration"] == DBNull.Value ? 0 : Convert.ToInt32(reader["Duration"]),
                        CalculatedLoadForSession = reader["CalculatedLoadForSession"] == DBNull.Value ? 0 : Convert.ToInt32(reader["CalculatedLoadForSession"]),
                        IsConfirmed = reader["IsConfirmed"] as bool? ?? false
                    });
                }
            }
            return list;
        }
    }
}
