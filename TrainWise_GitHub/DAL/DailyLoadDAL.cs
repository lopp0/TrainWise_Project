using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;


namespace TrainWise.DAL
{
    public class DailyLoadDAL : DBservice
    {
        public (double acute, double chronic, double? acRatio, int stressScore, string loadLevel) CalculateDailyLoad(int userId, DateTime date)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", userId},
                    {"@Date", date.Date }
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_CalculateDailyLoad", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        double acute = Convert.ToDouble(reader["AcuteLoad"]);
                        double chronic = Convert.ToDouble(reader["ChronicLoad"]);
                        double? acRatio = reader["AC_Ratio"] == DBNull.Value ? (double?)null : Convert.ToDouble(reader["AC_Ratio"]);
                        int stress = Convert.ToInt32(reader["StressScore"]);
                        string level = reader["LoadLevel"].ToString();

                        return (acute, chronic, acRatio, stress, level);
                    }
                }
            }
            return (0, 0, null, 0, "Green");
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
