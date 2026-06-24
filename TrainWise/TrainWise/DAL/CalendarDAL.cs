using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    // A-4 — plain parameterized SQL for planned workouts.
    public class CalendarDAL : DBservice
    {
        private static int Int(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToInt32(r[c]);
        private static int? IntN(SqlDataReader r, string c) => r[c] == DBNull.Value ? (int?)null : Convert.ToInt32(r[c]);
        private static double? DblN(SqlDataReader r, string c) => r[c] == DBNull.Value ? (double?)null : Convert.ToDouble(r[c]);
        private static string Str(SqlDataReader r, string c) => r[c] == DBNull.Value ? null : r[c].ToString();

        public List<PlannedWorkout> GetRange(int userId, DateTime from, DateTime to)
        {
            var list = new List<PlannedWorkout>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "SELECT * FROM dbo.PlannedWorkouts WHERE UserID=@u AND PlannedDate BETWEEN @from AND @to ORDER BY PlannedDate", con);
            cmd.Parameters.AddWithValue("@u", userId);
            cmd.Parameters.AddWithValue("@from", from.Date);
            cmd.Parameters.AddWithValue("@to", to.Date);
            using var r = cmd.ExecuteReader();
            while (r.Read()) list.Add(Map(r));
            return list;
        }

        public int Insert(PlannedWorkout p)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.PlannedWorkouts (UserID, CreatedByCoach, ActivityTypeId, PlannedDate, PlannedDuration, PlannedDistance, PlannedLoad, Notes)
VALUES (@UserID, @CreatedByCoach, @ActivityTypeId, @PlannedDate, @PlannedDuration, @PlannedDistance, @PlannedLoad, @Notes);
SELECT SCOPE_IDENTITY();", con);
            cmd.Parameters.AddWithValue("@UserID", p.UserID);
            cmd.Parameters.AddWithValue("@CreatedByCoach", (object?)p.CreatedByCoach ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ActivityTypeId", (object?)p.ActivityTypeId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@PlannedDate", p.PlannedDate.Date);
            cmd.Parameters.AddWithValue("@PlannedDuration", (object?)p.PlannedDuration ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@PlannedDistance", (object?)p.PlannedDistance ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@PlannedLoad", (object?)p.PlannedLoad ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Notes", (object?)p.Notes ?? DBNull.Value);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public void Update(PlannedWorkout p)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
UPDATE dbo.PlannedWorkouts
   SET ActivityTypeId=@ActivityTypeId, PlannedDate=@PlannedDate, PlannedDuration=@PlannedDuration,
       PlannedDistance=@PlannedDistance, PlannedLoad=@PlannedLoad, Notes=@Notes
 WHERE PlanId=@PlanId;", con);
            cmd.Parameters.AddWithValue("@PlanId", p.PlanId);
            cmd.Parameters.AddWithValue("@ActivityTypeId", (object?)p.ActivityTypeId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@PlannedDate", p.PlannedDate.Date);
            cmd.Parameters.AddWithValue("@PlannedDuration", (object?)p.PlannedDuration ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@PlannedDistance", (object?)p.PlannedDistance ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@PlannedLoad", (object?)p.PlannedLoad ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Notes", (object?)p.Notes ?? DBNull.Value);
            cmd.ExecuteNonQuery();
        }

        public void Delete(int planId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand("DELETE FROM dbo.PlannedWorkouts WHERE PlanId=@p", con);
            cmd.Parameters.AddWithValue("@p", planId);
            cmd.ExecuteNonQuery();
        }

        public void MarkComplete(int planId, int? linkedLogId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "UPDATE dbo.PlannedWorkouts SET IsCompleted=1, LinkedLogId=@l WHERE PlanId=@p", con);
            cmd.Parameters.AddWithValue("@p", planId);
            cmd.Parameters.AddWithValue("@l", (object?)linkedLogId ?? DBNull.Value);
            cmd.ExecuteNonQuery();
        }

        private static PlannedWorkout Map(SqlDataReader r) => new PlannedWorkout
        {
            PlanId = Int(r, "PlanId"),
            UserID = Int(r, "UserID"),
            CreatedByCoach = IntN(r, "CreatedByCoach"),
            ActivityTypeId = IntN(r, "ActivityTypeId"),
            PlannedDate = Convert.ToDateTime(r["PlannedDate"]),
            PlannedDuration = IntN(r, "PlannedDuration"),
            PlannedDistance = DblN(r, "PlannedDistance"),
            PlannedLoad = DblN(r, "PlannedLoad"),
            Notes = Str(r, "Notes"),
            IsCompleted = r["IsCompleted"] != DBNull.Value && Convert.ToBoolean(r["IsCompleted"]),
            LinkedLogId = IntN(r, "LinkedLogId"),
            CreatedAt = Convert.ToDateTime(r["CreatedAt"]),
        };
    }
}
