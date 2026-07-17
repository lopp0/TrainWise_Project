using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    // #132 — hydration & nutrition log. Parameterized inline SQL (like the
    // typing/reactions DAL); no stored procs needed for this small table.
    public class NutritionDAL : DBservice
    {
        public NutritionEntry Insert(NutritionEntry e)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.NutritionLog (UserID, LoggedAt, Kind, Name, Calories, WaterMl, Barcode)
OUTPUT INSERTED.EntryID, INSERTED.UserID, INSERTED.LoggedAt, INSERTED.Kind,
       INSERTED.Name, INSERTED.Calories, INSERTED.WaterMl, INSERTED.Barcode
VALUES (@UserID, SYSUTCDATETIME(), @Kind, @Name, @Calories, @WaterMl, @Barcode);", con);
            cmd.Parameters.AddWithValue("@UserID", e.UserID);
            cmd.Parameters.AddWithValue("@Kind", e.Kind);
            cmd.Parameters.AddWithValue("@Name", (object?)e.Name ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Calories", (object?)e.Calories ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@WaterMl", (object?)e.WaterMl ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Barcode", (object?)e.Barcode ?? DBNull.Value);
            using SqlDataReader reader = cmd.ExecuteReader();
            if (reader.Read()) return Map(reader);
            return e;
        }

        // Entries for one user inside a UTC time window (the caller computes the
        // window from the device's local calendar day + tz offset).
        public List<NutritionEntry> GetForRange(int userId, DateTime fromUtc, DateTime toUtc)
        {
            var list = new List<NutritionEntry>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT EntryID, UserID, LoggedAt, Kind, Name, Calories, WaterMl, Barcode
FROM dbo.NutritionLog
WHERE UserID = @UserID AND LoggedAt >= @From AND LoggedAt < @To
ORDER BY LoggedAt DESC;", con);
            cmd.Parameters.AddWithValue("@UserID", userId);
            cmd.Parameters.AddWithValue("@From", fromUtc);
            cmd.Parameters.AddWithValue("@To", toUtc);
            using SqlDataReader reader = cmd.ExecuteReader();
            while (reader.Read()) list.Add(Map(reader));
            return list;
        }

        public int? GetOwnerUserId(int entryId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "SELECT UserID FROM dbo.NutritionLog WHERE EntryID = @id;", con);
            cmd.Parameters.AddWithValue("@id", entryId);
            object result = cmd.ExecuteScalar();
            return result == null || result == DBNull.Value ? (int?)null : Convert.ToInt32(result);
        }

        public void Delete(int entryId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "DELETE FROM dbo.NutritionLog WHERE EntryID = @id;", con);
            cmd.Parameters.AddWithValue("@id", entryId);
            cmd.ExecuteNonQuery();
        }

        private static NutritionEntry Map(SqlDataReader r) => new NutritionEntry
        {
            EntryID = Convert.ToInt32(r["EntryID"]),
            UserID = Convert.ToInt32(r["UserID"]),
            LoggedAt = Convert.ToDateTime(r["LoggedAt"]),
            Kind = r["Kind"].ToString(),
            Name = r["Name"] == DBNull.Value ? null : r["Name"].ToString(),
            Calories = r["Calories"] == DBNull.Value ? (int?)null : Convert.ToInt32(r["Calories"]),
            WaterMl = r["WaterMl"] == DBNull.Value ? (int?)null : Convert.ToInt32(r["WaterMl"]),
            Barcode = r["Barcode"] == DBNull.Value ? null : r["Barcode"].ToString()
        };
    }
}
