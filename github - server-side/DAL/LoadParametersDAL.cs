using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    public class LoadParametersDAL : DBservice
    {
        public LoadParameters? GetLoadParameters()
        {
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetLoadParameters", con, null))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                if (reader.Read())
                {
                    return new LoadParameters
                    {
                        ParamID = (int)reader["ParamID"],
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
                    };
                }
            }
            return null;
        }
    }
}
