using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    // #133 — plain parameterized SQL for training programs, assignments, and the
    // per-assignment chat. Follows CalendarDAL's inline-SQL style (no stored
    // procs) — everything is parameterized, so it is injection-safe.
    public class ProgramDAL : DBservice
    {
        private static int Int(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToInt32(r[c]);
        private static int? IntN(SqlDataReader r, string c) => r[c] == DBNull.Value ? (int?)null : Convert.ToInt32(r[c]);
        private static double? DblN(SqlDataReader r, string c) => r[c] == DBNull.Value ? (double?)null : Convert.ToDouble(r[c]);
        private static string Str(SqlDataReader r, string c) => r[c] == DBNull.Value ? null : r[c].ToString();
        private static DateTime Dt(SqlDataReader r, string c) => Convert.ToDateTime(r[c]);
        private static object N(object v) => v ?? DBNull.Value;

        // ── programs ────────────────────────────────────────────────────────────
        public int CreateProgram(TrainingProgram p)
        {
            using SqlConnection con = Connect();
            using SqlTransaction tx = con.BeginTransaction();
            try
            {
                using (SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.TrainingPrograms (CoachUserID, Name, Description, DurationWeeks)
VALUES (@Coach, @Name, @Desc, @Weeks);
SELECT SCOPE_IDENTITY();", con, tx))
                {
                    cmd.Parameters.AddWithValue("@Coach", p.CoachUserID);
                    cmd.Parameters.AddWithValue("@Name", p.Name);
                    cmd.Parameters.AddWithValue("@Desc", N(p.Description));
                    cmd.Parameters.AddWithValue("@Weeks", p.DurationWeeks);
                    p.ProgramID = Convert.ToInt32(cmd.ExecuteScalar());
                }

                foreach (var w in p.Workouts)
                    InsertWorkout(con, tx, p.ProgramID, w);

                tx.Commit();
                return p.ProgramID;
            }
            catch { tx.Rollback(); throw; }
        }

        private static void InsertWorkout(SqlConnection con, SqlTransaction tx, int programId, ProgramWorkout w)
        {
            using SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.ProgramWorkouts (ProgramID, WeekNumber, DayOfWeek, ActivityTypeID, Duration, Distance, [Load], Notes)
VALUES (@P, @Wk, @Day, @Act, @Dur, @Dist, @Load, @Notes);", con, tx);
            cmd.Parameters.AddWithValue("@P", programId);
            cmd.Parameters.AddWithValue("@Wk", w.WeekNumber);
            cmd.Parameters.AddWithValue("@Day", w.DayOfWeek);
            cmd.Parameters.AddWithValue("@Act", N(w.ActivityTypeID));
            cmd.Parameters.AddWithValue("@Dur", N(w.Duration));
            cmd.Parameters.AddWithValue("@Dist", N(w.Distance));
            cmd.Parameters.AddWithValue("@Load", N(w.Load));
            cmd.Parameters.AddWithValue("@Notes", N(w.Notes));
            cmd.ExecuteNonQuery();
        }

        public void UpdateProgram(TrainingProgram p)
        {
            using SqlConnection con = Connect();
            using SqlTransaction tx = con.BeginTransaction();
            try
            {
                using (SqlCommand cmd = new SqlCommand(
                    "UPDATE dbo.TrainingPrograms SET Name=@Name, Description=@Desc, DurationWeeks=@Weeks WHERE ProgramID=@Id;", con, tx))
                {
                    cmd.Parameters.AddWithValue("@Id", p.ProgramID);
                    cmd.Parameters.AddWithValue("@Name", p.Name);
                    cmd.Parameters.AddWithValue("@Desc", N(p.Description));
                    cmd.Parameters.AddWithValue("@Weeks", p.DurationWeeks);
                    cmd.ExecuteNonQuery();
                }
                // Replace the template rows wholesale (simplest correct edit).
                using (SqlCommand cmd = new SqlCommand("DELETE FROM dbo.ProgramWorkouts WHERE ProgramID=@Id;", con, tx))
                {
                    cmd.Parameters.AddWithValue("@Id", p.ProgramID);
                    cmd.ExecuteNonQuery();
                }
                foreach (var w in p.Workouts) InsertWorkout(con, tx, p.ProgramID, w);
                tx.Commit();
            }
            catch { tx.Rollback(); throw; }
        }

        public List<TrainingProgram> GetProgramsByCoach(int coachUserId)
        {
            var list = new List<TrainingProgram>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT p.*, (SELECT COUNT(*) FROM dbo.ProgramWorkouts w WHERE w.ProgramID = p.ProgramID) AS WorkoutCount
FROM dbo.TrainingPrograms p
WHERE p.CoachUserID = @c
ORDER BY p.CreatedAt DESC;", con);
            cmd.Parameters.AddWithValue("@c", coachUserId);
            using var r = cmd.ExecuteReader();
            while (r.Read()) list.Add(MapProgram(r));
            return list;
        }

        public TrainingProgram GetProgram(int programId)
        {
            using SqlConnection con = Connect();
            TrainingProgram prog = null;
            using (SqlCommand cmd = new SqlCommand(@"
SELECT p.*, (SELECT COUNT(*) FROM dbo.ProgramWorkouts w WHERE w.ProgramID = p.ProgramID) AS WorkoutCount
FROM dbo.TrainingPrograms p WHERE p.ProgramID = @p;", con))
            {
                cmd.Parameters.AddWithValue("@p", programId);
                using var r = cmd.ExecuteReader();
                if (r.Read()) prog = MapProgram(r);
            }
            if (prog == null) return null;

            using (SqlCommand cmd = new SqlCommand(
                "SELECT * FROM dbo.ProgramWorkouts WHERE ProgramID = @p ORDER BY WeekNumber, DayOfWeek;", con))
            {
                cmd.Parameters.AddWithValue("@p", programId);
                using var r = cmd.ExecuteReader();
                while (r.Read()) prog.Workouts.Add(MapWorkout(r));
            }
            return prog;
        }

        public int? GetProgramCoachId(int programId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "SELECT CoachUserID FROM dbo.TrainingPrograms WHERE ProgramID = @p", con);
            cmd.Parameters.AddWithValue("@p", programId);
            var v = cmd.ExecuteScalar();
            return v == null || v == DBNull.Value ? (int?)null : Convert.ToInt32(v);
        }

        public List<int> GetAssignmentIdsForProgram(int programId)
        {
            var ids = new List<int>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "SELECT AssignmentID FROM dbo.ProgramAssignments WHERE ProgramID = @p", con);
            cmd.Parameters.AddWithValue("@p", programId);
            using var r = cmd.ExecuteReader();
            while (r.Read()) ids.Add(Convert.ToInt32(r["AssignmentID"]));
            return ids;
        }

        public void DeleteProgram(int programId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "DELETE FROM dbo.TrainingPrograms WHERE ProgramID = @p", con);
            cmd.Parameters.AddWithValue("@p", programId);
            cmd.ExecuteNonQuery();
        }

        // ── assignment (with calendar fan-out) ───────────────────────────────────
        // PlannedDate = StartDate + (WeekNumber-1)*7 + DayOfWeek, i.e. StartDate is
        // treated as day-0 (Monday) of week 1. Runs in one transaction so a partial
        // fan-out can't leave an assignment with half a calendar.
        public int AssignProgram(int programId, int traineeUserId, int coachUserId, DateTime startDate)
        {
            using SqlConnection con = Connect();
            using SqlTransaction tx = con.BeginTransaction();
            try
            {
                int assignmentId;
                using (SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.ProgramAssignments (ProgramID, TraineeUserID, CoachUserID, StartDate)
VALUES (@P, @T, @C, @S);
SELECT SCOPE_IDENTITY();", con, tx))
                {
                    cmd.Parameters.AddWithValue("@P", programId);
                    cmd.Parameters.AddWithValue("@T", traineeUserId);
                    cmd.Parameters.AddWithValue("@C", coachUserId);
                    cmd.Parameters.AddWithValue("@S", startDate.Date);
                    assignmentId = Convert.ToInt32(cmd.ExecuteScalar());
                }

                // Program duration — the weekly pattern repeats this many times.
                int weeks = 1;
                using (SqlCommand cmd = new SqlCommand(
                    "SELECT DurationWeeks FROM dbo.TrainingPrograms WHERE ProgramID = @p;", con, tx))
                {
                    cmd.Parameters.AddWithValue("@p", programId);
                    var v = cmd.ExecuteScalar();
                    if (v != null && v != DBNull.Value) weeks = Math.Max(1, Convert.ToInt32(v));
                }

                // Read the template rows. The program is a WEEKLY PATTERN keyed by
                // DayOfWeek (one workout per weekday — #12), repeated for every week
                // of the program's duration (#3). Dedupe by day, keeping the first.
                var patternByDay = new Dictionary<int, ProgramWorkout>();
                using (SqlCommand cmd = new SqlCommand(
                    "SELECT * FROM dbo.ProgramWorkouts WHERE ProgramID = @p ORDER BY DayOfWeek, ProgramWorkoutID;", con, tx))
                {
                    cmd.Parameters.AddWithValue("@p", programId);
                    using var r = cmd.ExecuteReader();
                    while (r.Read())
                    {
                        var w = MapWorkout(r);
                        if (!patternByDay.ContainsKey(w.DayOfWeek)) patternByDay[w.DayOfWeek] = w;
                    }
                }

                for (int week = 1; week <= weeks; week++)
                {
                    foreach (var w in patternByDay.Values)
                    {
                        DateTime date = startDate.Date.AddDays((week - 1) * 7 + w.DayOfWeek);

                        // One planned workout per day (#12): skip if the trainee
                        // already has any planned workout on this date.
                        using (SqlCommand chk = new SqlCommand(
                            "SELECT COUNT(*) FROM dbo.PlannedWorkouts WHERE UserID = @U AND PlannedDate = @Date;", con, tx))
                        {
                            chk.Parameters.AddWithValue("@U", traineeUserId);
                            chk.Parameters.AddWithValue("@Date", date);
                            if (Convert.ToInt32(chk.ExecuteScalar()) > 0) continue;
                        }

                        using SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.PlannedWorkouts (UserID, CreatedByCoach, ActivityTypeId, PlannedDate, PlannedDuration, PlannedDistance, PlannedLoad, Notes, SourceAssignmentId)
VALUES (@U, @C, @Act, @Date, @Dur, @Dist, @Load, @Notes, @Asg);", con, tx);
                        cmd.Parameters.AddWithValue("@U", traineeUserId);
                        cmd.Parameters.AddWithValue("@C", coachUserId);
                        cmd.Parameters.AddWithValue("@Act", N(w.ActivityTypeID));
                        cmd.Parameters.AddWithValue("@Date", date);
                        cmd.Parameters.AddWithValue("@Dur", N(w.Duration));
                        cmd.Parameters.AddWithValue("@Dist", N(w.Distance));
                        cmd.Parameters.AddWithValue("@Load", N(w.Load));
                        cmd.Parameters.AddWithValue("@Notes", N(w.Notes));
                        cmd.Parameters.AddWithValue("@Asg", assignmentId);
                        cmd.ExecuteNonQuery();
                    }
                }

                tx.Commit();
                return assignmentId;
            }
            catch { tx.Rollback(); throw; }
        }

        public List<ProgramAssignment> GetAssignmentsForTrainee(int traineeUserId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(AssignmentSelect + "WHERE a.TraineeUserID = @u ORDER BY a.AssignedAt DESC;", con);
            cmd.Parameters.AddWithValue("@u", traineeUserId);
            return ReadAssignments(cmd);
        }

        public List<ProgramAssignment> GetAssignmentsForCoach(int coachUserId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(AssignmentSelect + "WHERE a.CoachUserID = @u ORDER BY a.AssignedAt DESC;", con);
            cmd.Parameters.AddWithValue("@u", coachUserId);
            return ReadAssignments(cmd);
        }

        public ProgramAssignment GetAssignment(int assignmentId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(AssignmentSelect + "WHERE a.AssignmentID = @a;", con);
            cmd.Parameters.AddWithValue("@a", assignmentId);
            var list = ReadAssignments(cmd);
            return list.Count > 0 ? list[0] : null;
        }

        public void DeleteAssignment(int assignmentId)
        {
            using SqlConnection con = Connect();
            using SqlTransaction tx = con.BeginTransaction();
            try
            {
                // remove ONLY the calendar rows this assignment generated
                using (SqlCommand cmd = new SqlCommand(
                    "DELETE FROM dbo.PlannedWorkouts WHERE SourceAssignmentId = @a;", con, tx))
                {
                    cmd.Parameters.AddWithValue("@a", assignmentId);
                    cmd.ExecuteNonQuery();
                }
                // the assignment (cascades its chat messages)
                using (SqlCommand cmd = new SqlCommand(
                    "DELETE FROM dbo.ProgramAssignments WHERE AssignmentID = @a;", con, tx))
                {
                    cmd.Parameters.AddWithValue("@a", assignmentId);
                    cmd.ExecuteNonQuery();
                }
                tx.Commit();
            }
            catch { tx.Rollback(); throw; }
        }

        private const string AssignmentSelect = @"
SELECT a.AssignmentID, a.ProgramID, a.TraineeUserID, a.CoachUserID, a.StartDate, a.Status, a.AssignedAt,
       p.Name AS ProgramName, p.DurationWeeks,
       c.FullName AS CoachName, t.FullName AS TraineeName,
       (SELECT COUNT(*) FROM dbo.ProgramWorkouts w WHERE w.ProgramID = a.ProgramID) AS WorkoutCount
FROM dbo.ProgramAssignments a
JOIN dbo.TrainingPrograms p ON p.ProgramID = a.ProgramID
JOIN dbo.Users c ON c.UserID = a.CoachUserID
JOIN dbo.Users t ON t.UserID = a.TraineeUserID
";

        private static List<ProgramAssignment> ReadAssignments(SqlCommand cmd)
        {
            var list = new List<ProgramAssignment>();
            using var r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new ProgramAssignment
                {
                    AssignmentID = Int(r, "AssignmentID"),
                    ProgramID = Int(r, "ProgramID"),
                    TraineeUserID = Int(r, "TraineeUserID"),
                    CoachUserID = Int(r, "CoachUserID"),
                    StartDate = Dt(r, "StartDate"),
                    Status = Str(r, "Status"),
                    AssignedAt = Dt(r, "AssignedAt"),
                    ProgramName = Str(r, "ProgramName"),
                    DurationWeeks = Int(r, "DurationWeeks"),
                    CoachName = Str(r, "CoachName"),
                    TraineeName = Str(r, "TraineeName"),
                    WorkoutCount = Int(r, "WorkoutCount"),
                });
            return list;
        }

        // ── per-assignment chat (mirrors the event chat) ─────────────────────────
        public ProgramMessage PostMessage(int assignmentId, int senderId, string text, string imagePath, string videoPath, string audioPath)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.ProgramMessages (AssignmentId, SenderId, [Text], ImagePath, VideoPath, AudioPath)
VALUES (@A, @S, @T, @Img, @Vid, @Aud);
SELECT m.MessageId, m.AssignmentId, m.SenderId, u.FullName AS SenderName, u.ProfileImagePath AS SenderImage,
       m.[Text], m.ImagePath, m.VideoPath, m.AudioPath, m.CreatedAt, 0 AS SeenCount
FROM dbo.ProgramMessages m JOIN dbo.Users u ON u.UserID = m.SenderId
WHERE m.MessageId = SCOPE_IDENTITY();", con);
            cmd.Parameters.AddWithValue("@A", assignmentId);
            cmd.Parameters.AddWithValue("@S", senderId);
            cmd.Parameters.AddWithValue("@T", N(text));
            cmd.Parameters.AddWithValue("@Img", N(imagePath));
            cmd.Parameters.AddWithValue("@Vid", N(videoPath));
            cmd.Parameters.AddWithValue("@Aud", N(audioPath));
            using var r = cmd.ExecuteReader();
            return r.Read() ? MapMessage(r) : null;
        }

        public List<ProgramMessage> GetMessages(int assignmentId)
        {
            var list = new List<ProgramMessage>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT m.MessageId, m.AssignmentId, m.SenderId, u.FullName AS SenderName, u.ProfileImagePath AS SenderImage,
       m.[Text], m.ImagePath, m.VideoPath, m.AudioPath, m.CreatedAt,
       (SELECT COUNT(*) FROM dbo.ProgramMessageReads rd WHERE rd.MessageId = m.MessageId AND rd.UserId <> m.SenderId) AS SeenCount
FROM dbo.ProgramMessages m JOIN dbo.Users u ON u.UserID = m.SenderId
WHERE m.AssignmentId = @a
ORDER BY m.CreatedAt ASC, m.MessageId ASC;", con);
            cmd.Parameters.AddWithValue("@a", assignmentId);
            using var r = cmd.ExecuteReader();
            while (r.Read()) list.Add(MapMessage(r));
            return list;
        }

        public void MarkSeen(int assignmentId, int userId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.ProgramMessageReads (MessageId, UserId)
SELECT m.MessageId, @u FROM dbo.ProgramMessages m
WHERE m.AssignmentId = @a AND m.SenderId <> @u
  AND NOT EXISTS (SELECT 1 FROM dbo.ProgramMessageReads rd WHERE rd.MessageId = m.MessageId AND rd.UserId = @u);", con);
            cmd.Parameters.AddWithValue("@a", assignmentId);
            cmd.Parameters.AddWithValue("@u", userId);
            cmd.ExecuteNonQuery();
        }

        public void React(int messageId, int userId, string emoji)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
DECLARE @existing NVARCHAR(16) = (SELECT Emoji FROM dbo.ProgramMessageReactions WHERE MessageId=@m AND UserId=@u);
IF @existing IS NULL
    INSERT INTO dbo.ProgramMessageReactions (MessageId, UserId, Emoji) VALUES (@m, @u, @e);
ELSE IF @existing = @e
    DELETE FROM dbo.ProgramMessageReactions WHERE MessageId=@m AND UserId=@u;
ELSE
    UPDATE dbo.ProgramMessageReactions SET Emoji=@e WHERE MessageId=@m AND UserId=@u;", con);
            cmd.Parameters.AddWithValue("@m", messageId);
            cmd.Parameters.AddWithValue("@u", userId);
            cmd.Parameters.AddWithValue("@e", emoji);
            cmd.ExecuteNonQuery();
        }

        public List<ProgramMessageReaction> GetReactions(int assignmentId)
        {
            var list = new List<ProgramMessageReaction>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT rx.MessageId, rx.UserId, rx.Emoji
FROM dbo.ProgramMessageReactions rx
JOIN dbo.ProgramMessages m ON m.MessageId = rx.MessageId
WHERE m.AssignmentId = @a;", con);
            cmd.Parameters.AddWithValue("@a", assignmentId);
            using var r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new ProgramMessageReaction { MessageId = Int(r, "MessageId"), UserId = Int(r, "UserId"), Emoji = Str(r, "Emoji") });
            return list;
        }

        // ── mappers ──────────────────────────────────────────────────────────────
        private static TrainingProgram MapProgram(SqlDataReader r) => new TrainingProgram
        {
            ProgramID = Int(r, "ProgramID"),
            CoachUserID = Int(r, "CoachUserID"),
            Name = Str(r, "Name"),
            Description = Str(r, "Description"),
            DurationWeeks = Int(r, "DurationWeeks"),
            CreatedAt = Dt(r, "CreatedAt"),
            WorkoutCount = Int(r, "WorkoutCount"),
        };

        private static ProgramWorkout MapWorkout(SqlDataReader r) => new ProgramWorkout
        {
            ProgramWorkoutID = Int(r, "ProgramWorkoutID"),
            ProgramID = Int(r, "ProgramID"),
            WeekNumber = Int(r, "WeekNumber"),
            DayOfWeek = Int(r, "DayOfWeek"),
            ActivityTypeID = IntN(r, "ActivityTypeID"),
            Duration = IntN(r, "Duration"),
            Distance = DblN(r, "Distance"),
            Load = DblN(r, "Load"),
            Notes = Str(r, "Notes"),
        };

        private static ProgramMessage MapMessage(SqlDataReader r) => new ProgramMessage
        {
            MessageId = Int(r, "MessageId"),
            AssignmentId = Int(r, "AssignmentId"),
            SenderId = Int(r, "SenderId"),
            SenderName = Str(r, "SenderName"),
            SenderImage = Str(r, "SenderImage"),
            Text = Str(r, "Text"),
            ImagePath = Str(r, "ImagePath"),
            VideoPath = Str(r, "VideoPath"),
            AudioPath = Str(r, "AudioPath"),
            SeenCount = Int(r, "SeenCount"),
            CreatedAt = Dt(r, "CreatedAt"),
        };
    }
}
