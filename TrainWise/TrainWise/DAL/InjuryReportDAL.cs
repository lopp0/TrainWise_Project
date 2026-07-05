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
                    {"@Notes", ir.Notes},
                    {"@IsActiveInjury", ir.IsActiveInjury},
                    {"@LinkedActivityLogID", (object?)ir.LinkedActivityLogID ?? DBNull.Value}
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
                    list.Add(MapInjury(reader));
            }
            return list;
        }

        public List<InjuryReport> GetActiveInjuriesByUser(int userId)
        {
            var list = new List<InjuryReport>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetActiveInjuriesByUser", con, new Dictionary<string, object> { { "@UserID", userId } }))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                    list.Add(MapInjury(reader));
            }
            return list;
        }

        public void MarkRecovered(int injuryId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@InjuryID", injuryId}
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_MarkInjuryRecovered", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        // Owner (trainee) of an injury row, for authorization. Null if absent.
        public int? GetOwnerUserId(int injuryId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "SELECT UserID FROM dbo.InjuriesReports WHERE InjuryID = @id", con);
            cmd.Parameters.AddWithValue("@id", injuryId);
            var v = cmd.ExecuteScalar();
            return v == null || v == DBNull.Value ? (int?)null : Convert.ToInt32(v);
        }

        // #127 — daily pain-level log per injury (inline SQL; no proc).
        public int InsertPainLog(int injuryId, int level, string? note)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.InjuryPainLog (InjuryID, LoggedAt, Level, Note)
VALUES (@i, SYSUTCDATETIME(), @l, @n);
SELECT SCOPE_IDENTITY();", con);
            cmd.Parameters.AddWithValue("@i", injuryId);
            cmd.Parameters.AddWithValue("@l", level);
            cmd.Parameters.AddWithValue("@n", (object?)note ?? DBNull.Value);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public List<PainLog> GetPainLogs(int injuryId)
        {
            var list = new List<PainLog>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT PainLogID, InjuryID, LoggedAt, Level, Note
FROM dbo.InjuryPainLog WHERE InjuryID = @i ORDER BY LoggedAt ASC;", con);
            cmd.Parameters.AddWithValue("@i", injuryId);
            using var r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new PainLog
                {
                    PainLogID = Convert.ToInt32(r["PainLogID"]),
                    InjuryID = Convert.ToInt32(r["InjuryID"]),
                    LoggedAt = (DateTime)r["LoggedAt"],
                    Level = Convert.ToInt32(r["Level"]),
                    Note = r["Note"] == DBNull.Value ? null : r["Note"].ToString()
                });
            return list;
        }

        private InjuryReport MapInjury(SqlDataReader reader)
        {
            return new InjuryReport
            {
                InjuryID = (int)reader["InjuryID"],
                UserID = (int)reader["UserID"],
                InjuryTypeID = (int)reader["InjuryTypeID"],
                Date = (DateTime)reader["Date"],
                Severity = (int)reader["Severity"],
                Notes = reader["Notes"].ToString(),
                IsActiveInjury = reader["IsActiveInjury"] as bool? ?? false,
                // Defensive: the Get procs may not SELECT this column yet.
                LinkedActivityLogID = HasColumn(reader, "LinkedActivityLogID") && reader["LinkedActivityLogID"] != DBNull.Value
                    ? Convert.ToInt32(reader["LinkedActivityLogID"])
                    : (int?)null
            };
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
    }
}
