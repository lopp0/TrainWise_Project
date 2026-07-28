using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    // #119 — reusable workout templates. Parameterized inline SQL.
    public class WorkoutTemplateDAL : DBservice
    {
        public WorkoutTemplate Insert(WorkoutTemplate t)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.WorkoutTemplates (UserID, Name, ActivityTypeID, Duration, ExertionLevel, TargetValue)
OUTPUT INSERTED.TemplateID, INSERTED.UserID, INSERTED.Name, INSERTED.ActivityTypeID,
       INSERTED.Duration, INSERTED.ExertionLevel, INSERTED.TargetValue, INSERTED.CreatedAt
VALUES (@UserID, @Name, @ActivityTypeID, @Duration, @ExertionLevel, @TargetValue);", con);
            cmd.Parameters.AddWithValue("@UserID", t.UserID);
            cmd.Parameters.AddWithValue("@Name", t.Name);
            cmd.Parameters.AddWithValue("@ActivityTypeID", t.ActivityTypeID);
            cmd.Parameters.AddWithValue("@Duration", t.Duration);
            cmd.Parameters.AddWithValue("@ExertionLevel", t.ExertionLevel);
            cmd.Parameters.AddWithValue("@TargetValue", (object?)t.TargetValue ?? DBNull.Value);
            using SqlDataReader reader = cmd.ExecuteReader();
            if (reader.Read()) return Map(reader);
            return t;
        }

        public List<WorkoutTemplate> GetByUser(int userId)
        {
            var list = new List<WorkoutTemplate>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT TemplateID, UserID, Name, ActivityTypeID, Duration, ExertionLevel, TargetValue, CreatedAt
FROM dbo.WorkoutTemplates
WHERE UserID = @UserID
ORDER BY CreatedAt DESC;", con);
            cmd.Parameters.AddWithValue("@UserID", userId);
            using SqlDataReader reader = cmd.ExecuteReader();
            while (reader.Read()) list.Add(Map(reader));
            return list;
        }

        public int? GetOwnerUserId(int templateId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "SELECT UserID FROM dbo.WorkoutTemplates WHERE TemplateID = @id;", con);
            cmd.Parameters.AddWithValue("@id", templateId);
            object result = cmd.ExecuteScalar();
            return result == null || result == DBNull.Value ? (int?)null : Convert.ToInt32(result);
        }

        public void Delete(int templateId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "DELETE FROM dbo.WorkoutTemplates WHERE TemplateID = @id;", con);
            cmd.Parameters.AddWithValue("@id", templateId);
            cmd.ExecuteNonQuery();
        }

        private static WorkoutTemplate Map(SqlDataReader r) => new WorkoutTemplate
        {
            TemplateID = Convert.ToInt32(r["TemplateID"]),
            UserID = Convert.ToInt32(r["UserID"]),
            Name = r["Name"].ToString(),
            ActivityTypeID = Convert.ToInt32(r["ActivityTypeID"]),
            Duration = Convert.ToInt32(r["Duration"]),
            ExertionLevel = Convert.ToByte(r["ExertionLevel"]),
            TargetValue = r["TargetValue"] == DBNull.Value ? (double?)null : Convert.ToDouble(r["TargetValue"]),
            CreatedAt = Convert.ToDateTime(r["CreatedAt"])
        };
    }
}
