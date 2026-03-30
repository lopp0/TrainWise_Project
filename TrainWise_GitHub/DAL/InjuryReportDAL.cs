using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;


namespace TrainWise.DAL
{
    public class InjuryReportDAL : DBservice
    {
        public int InsertInjuryReport(InjuryReport ir)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", ir.UserID},
                    {"@InjuryTypeID", ir.InjuryTypeID},
                    {"@Date", ir.Date},
                    {"@Severity", ir.Severity},
                    {"@Notes", ir.Notes}
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InsertInjuryReport", con, param))
                {
                    object id = cmd.ExecuteScalar();
                    return Convert.ToInt32(id);
                }
            }
        }

        public List<InjuryReport> GetInjuriesByUser(int userId)
        {
            var list = new List<InjuryReport>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetInjuriesByUser", con, new Dictionary<string, object> { { "@UserID", userId } }))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    list.Add(new InjuryReport
                    {
                        InjuryID = (int)reader["InjuryID"],
                        UserID = (int)reader["UserID"],
                        InjuryTypeID = (int)reader["InjuryTypeID"],
                        Date = (DateTime)reader["Date"],
                        Severity = (int)reader["Severity"],
                        Notes = reader["Notes"].ToString(),
                    });
                }
            }
            return list;
        }
    }
}
