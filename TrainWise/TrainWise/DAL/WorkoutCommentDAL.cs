using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    // #134 — coach comments on a workout. Same ADO.NET / stored-procedure idiom.
    public class WorkoutCommentDAL : DBservice
    {
        private static string Str(SqlDataReader r, string c) => r[c] == DBNull.Value ? null : r[c].ToString();
        private static int Int(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToInt32(r[c]);
        private static bool Bool(SqlDataReader r, string c) => r[c] != DBNull.Value && Convert.ToBoolean(r[c]);
        private static DateTime Dt(SqlDataReader r, string c) => r[c] == DBNull.Value ? default : Convert.ToDateTime(r[c]);

        public List<WorkoutComment> GetComments(int activityId)
        {
            var list = new List<WorkoutComment>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@ActivityID", activityId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetWorkoutComments", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new WorkoutComment
                {
                    CommentId = Int(r, "CommentId"),
                    ActivityID = Int(r, "ActivityID"),
                    AuthorUserID = Int(r, "AuthorUserID"),
                    AuthorName = Str(r, "AuthorName"),
                    AuthorImage = Str(r, "AuthorImage"),
                    IsCoach = Bool(r, "IsCoach"),
                    Text = Str(r, "Text"),
                    CreatedAt = Dt(r, "CreatedAt")
                });
            return list;
        }

        public int AddComment(int activityId, int authorUserId, string text)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@ActivityID", activityId }, { "@AuthorUserID", authorUserId }, { "@Text", text }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_AddWorkoutComment", con, p);
            var o = cmd.ExecuteScalar();
            return o == null || o == DBNull.Value ? 0 : Convert.ToInt32(o);
        }

        public void DeleteComment(int commentId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@CommentId", commentId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_DeleteWorkoutComment", con, p);
            cmd.ExecuteNonQuery();
        }

        // Owner of the workout log (0 if the log doesn't exist).
        public int GetLogOwner(int activityId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand("SELECT UserID FROM dbo.ActivityLogs WHERE ActivityID = @id", con);
            cmd.Parameters.AddWithValue("@id", activityId);
            var o = cmd.ExecuteScalar();
            return o == null || o == DBNull.Value ? 0 : Convert.ToInt32(o);
        }

        // Author of a comment (0 if it doesn't exist) — for delete authorisation.
        public int GetCommentAuthor(int commentId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand("SELECT AuthorUserID FROM dbo.WorkoutComments WHERE CommentId = @id", con);
            cmd.Parameters.AddWithValue("@id", commentId);
            var o = cmd.ExecuteScalar();
            return o == null || o == DBNull.Value ? 0 : Convert.ToInt32(o);
        }

        // Is `coachUserId` a coach of `traineeUserId` (CoachTrainees link)?
        public bool IsCoachOf(int coachUserId, int traineeUserId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                @"SELECT COUNT(*) FROM dbo.CoachTrainees ct
                  JOIN dbo.Coaches co ON co.CoachID = ct.CoachID
                  WHERE co.UserID = @coach AND ct.UserID = @trainee", con);
            cmd.Parameters.AddWithValue("@coach", coachUserId);
            cmd.Parameters.AddWithValue("@trainee", traineeUserId);
            return Convert.ToInt32(cmd.ExecuteScalar()) > 0;
        }
    }
}
