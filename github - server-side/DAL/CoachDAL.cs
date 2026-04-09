using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;
using System;
using System.Collections.Generic;

namespace TrainWise.DAL
{
    public class CoachDAL : DBservice
    {
        public Coach? GetCoachById(int coachId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@CoachID", coachId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetCoachByID", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        return new Coach
                        {
                            CoachID = (int)reader["CoachID"],
                            FullName = reader["FullName"].ToString(),
                            Email = reader["Email"].ToString()
                        };
                    }
                }
            }
            return null;
        }

        public List<TraineeSummary> GetTraineesWithLoad(int coachId)
        {
            var list = new List<TraineeSummary>();
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@CoachID", coachId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetTraineesWithLoadByCoach", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new TraineeSummary
                        {
                            UserID = (int)reader["UserID"],
                            FullName = reader["FullName"].ToString(),
                            BirthYear = reader["BirthYear"] as int? ?? 0,
                            Gender = reader["Gender"].ToString(),
                            DeviceType = reader["DeviceType"].ToString(),
                            LastDate = reader["Date"] as DateTime?,
                            AcuteLoad = reader["AcuteLoad"] as double?,
                            ChronicLoad = reader["ChronicLoad"] as double?,
                            AC_Ratio = reader["AC_Ratio"] == DBNull.Value ? (double?)null : Convert.ToDouble(reader["AC_Ratio"]),
                            LoadLevel = reader["LoadLevel"].ToString()
                        });
                    }
                }
            }
            return list;
        }

        public List<DailyLoad> GetTraineeLoadHistory(int coachId, int userId)
        {
            var list = new List<DailyLoad>();
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    { "@CoachID", coachId },
                    { "@UserID", userId }
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetTraineeDailyLoadForCoach", con, param))
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
            }
            return list;
        }

        public int InsertCoach(int userId, string fullName, string email)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
        {
            {"@UserID", userId},
            {"@FullName", fullName},
            {"@Email", email}
        };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InsertCoach", con, param))
                {
                    object id = cmd.ExecuteScalar();
                    return Convert.ToInt32(id);
                }
            }
        }
        
        public void DeleteCoach(int coachId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@CoachID", coachId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_DeleteCoach", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public Coach? GetCoachByUserId(int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetCoachByUserID", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        return new Coach
                        {
                            CoachID = (int)reader["CoachID"],
                            UserID = (int)reader["UserID"],
                            FullName = reader["FullName"].ToString(),
                            Email = reader["Email"].ToString()
                        };
                    }
                }
            }
            return null;
        }
    }
}

