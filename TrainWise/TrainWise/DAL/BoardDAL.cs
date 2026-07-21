using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    // A-3 — plain parameterized SQL. Metric expressions for the leaderboard are
    // chosen from a whitelist (never raw user input) so there is no injection.
    public class BoardDAL : DBservice
    {
        private static string Str(SqlDataReader r, string c) => r[c] == DBNull.Value ? null : r[c].ToString();
        private static int Int(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToInt32(r[c]);
        private static double Dbl(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToDouble(r[c]);

        public List<WorkoutPost> GetFeed(int viewerId, string country, int page, int limit)
        {
            var list = new List<WorkoutPost>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT p.PostId, p.UserID, p.ActivityLogId, p.PostType, p.Title, p.Description,
       p.MetricType, p.MetricValue, p.ImagePath, p.IsPublic, p.Country, p.CreatedAt,
       u.FullName AS AuthorName, u.ProfileImagePath AS AuthorImagePath,
       u.EquippedBadge, u.EquippedTitle, u.EquippedFrame,
       (SELECT COUNT(*) FROM dbo.WorkoutPostLikes l WHERE l.PostId = p.PostId) AS LikeCount,
       (SELECT COUNT(*) FROM dbo.WorkoutPostComments c WHERE c.PostId = p.PostId) AS CommentCount,
       CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.WorkoutPostLikes l WHERE l.PostId = p.PostId AND l.UserID = @viewer)
                 THEN 1 ELSE 0 END AS BIT) AS LikedByMe,
       (SELECT TOP 1 f.Status FROM dbo.Friendships f
          WHERE (f.RequesterID = @viewer AND f.AddresseeID = p.UserID)
             OR (f.RequesterID = p.UserID AND f.AddresseeID = @viewer)) AS FriendStatus
FROM dbo.WorkoutPosts p
JOIN dbo.Users u ON p.UserID = u.UserID
WHERE p.IsPublic = 1 AND ISNULL(p.Country, 'IL') = @country
ORDER BY p.CreatedAt DESC
OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;", con);
            cmd.Parameters.AddWithValue("@viewer", viewerId);
            cmd.Parameters.AddWithValue("@country", country);
            cmd.Parameters.AddWithValue("@offset", page * limit);
            cmd.Parameters.AddWithValue("@limit", limit);
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                list.Add(new WorkoutPost
                {
                    PostId = Int(r, "PostId"),
                    UserID = Int(r, "UserID"),
                    ActivityLogId = r["ActivityLogId"] as int?,
                    PostType = Str(r, "PostType"),
                    Title = Str(r, "Title"),
                    Description = Str(r, "Description"),
                    MetricType = Str(r, "MetricType"),
                    MetricValue = r["MetricValue"] == DBNull.Value ? (double?)null : Convert.ToDouble(r["MetricValue"]),
                    ImagePath = Str(r, "ImagePath"),
                    IsPublic = r["IsPublic"] != DBNull.Value && Convert.ToBoolean(r["IsPublic"]),
                    Country = Str(r, "Country"),
                    CreatedAt = (DateTime)r["CreatedAt"],
                    AuthorName = Str(r, "AuthorName"),
                    AuthorImagePath = Str(r, "AuthorImagePath"),
                    EquippedBadge = Str(r, "EquippedBadge"),
                    EquippedTitle = Str(r, "EquippedTitle"),
                    EquippedFrame = Str(r, "EquippedFrame"),
                    LikeCount = Int(r, "LikeCount"),
                    CommentCount = Int(r, "CommentCount"),
                    LikedByMe = r["LikedByMe"] != DBNull.Value && Convert.ToBoolean(r["LikedByMe"]),
                    FriendStatus = Str(r, "FriendStatus"),
                });
            }
            return list;
        }

        public int Insert(WorkoutPost p)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
DECLARE @c NVARCHAR(100) = (SELECT ISNULL(Country, 'IL') FROM dbo.Users WHERE UserID = @UserID);
INSERT INTO dbo.WorkoutPosts (UserID, ActivityLogId, PostType, Title, Description, MetricType, MetricValue, ImagePath, IsPublic, Country)
VALUES (@UserID, @ActivityLogId, @PostType, @Title, @Description, @MetricType, @MetricValue, @ImagePath, @IsPublic, @c);
SELECT SCOPE_IDENTITY();", con);
            cmd.Parameters.AddWithValue("@UserID", p.UserID);
            cmd.Parameters.AddWithValue("@ActivityLogId", (object?)p.ActivityLogId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@PostType", (object?)p.PostType ?? "record");
            cmd.Parameters.AddWithValue("@Title", p.Title);
            cmd.Parameters.AddWithValue("@Description", (object?)p.Description ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@MetricType", (object?)p.MetricType ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@MetricValue", (object?)p.MetricValue ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ImagePath", (object?)p.ImagePath ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@IsPublic", p.IsPublic);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public void Delete(int postId, int userId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
DELETE FROM dbo.WorkoutPostLikes WHERE PostId = @p;
DELETE FROM dbo.WorkoutPosts WHERE PostId = @p AND UserID = @u;", con);
            cmd.Parameters.AddWithValue("@p", postId);
            cmd.Parameters.AddWithValue("@u", userId);
            cmd.ExecuteNonQuery();
        }

        // Returns true if the post is now liked by the user, false if unliked.
        public bool ToggleLike(int postId, int userId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
IF EXISTS (SELECT 1 FROM dbo.WorkoutPostLikes WHERE PostId = @p AND UserID = @u)
BEGIN
    DELETE FROM dbo.WorkoutPostLikes WHERE PostId = @p AND UserID = @u;
    SELECT 0;
END
ELSE
BEGIN
    INSERT INTO dbo.WorkoutPostLikes (PostId, UserID) VALUES (@p, @u);
    SELECT 1;
END", con);
            cmd.Parameters.AddWithValue("@p", postId);
            cmd.Parameters.AddWithValue("@u", userId);
            return Convert.ToInt32(cmd.ExecuteScalar()) == 1;
        }

        // #171 — toggle a kudos ("cheer") on a workout (ActivityLog). Returns
        // true if it's now kudoed by the user, false if removed.
        public bool ToggleKudos(int logId, int fromUserId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
IF EXISTS (SELECT 1 FROM dbo.WorkoutKudos WHERE LogID = @l AND FromUserID = @u)
BEGIN
    DELETE FROM dbo.WorkoutKudos WHERE LogID = @l AND FromUserID = @u;
    SELECT 0;
END
ELSE
BEGIN
    INSERT INTO dbo.WorkoutKudos (LogID, FromUserID) VALUES (@l, @u);
    SELECT 1;
END", con);
            cmd.Parameters.AddWithValue("@l", logId);
            cmd.Parameters.AddWithValue("@u", fromUserId);
            return Convert.ToInt32(cmd.ExecuteScalar()) == 1;
        }

        // #171 — kudos count for a workout + whether the viewer kudoed it.
        public (int count, bool kudoed) GetKudos(int logId, int viewerId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT COUNT(*) AS Cnt,
       CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.WorkoutKudos WHERE LogID = @l AND FromUserID = @v)
                 THEN 1 ELSE 0 END AS BIT) AS Mine
FROM dbo.WorkoutKudos WHERE LogID = @l;", con);
            cmd.Parameters.AddWithValue("@l", logId);
            cmd.Parameters.AddWithValue("@v", viewerId);
            using var r = cmd.ExecuteReader();
            if (r.Read())
                return (Int(r, "Cnt"), r["Mine"] != DBNull.Value && Convert.ToBoolean(r["Mine"]));
            return (0, false);
        }

        // Owner (UserID) of a workout, for the kudos push notification.
        public int GetActivityLogOwner(int logId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand("SELECT UserID FROM dbo.ActivityLogs WHERE ActivityID = @l", con);
            cmd.Parameters.AddWithValue("@l", logId);
            var v = cmd.ExecuteScalar();
            return v == null || v == DBNull.Value ? 0 : Convert.ToInt32(v);
        }

        public void SetLeaderboardOptIn(int userId, bool on)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "UPDATE dbo.Users SET IsOnLeaderboard = @on WHERE UserID = @u", con);
            cmd.Parameters.AddWithValue("@u", userId);
            cmd.Parameters.AddWithValue("@on", on);
            cmd.ExecuteNonQuery();
        }

        public List<LeaderboardEntry> GetLeaderboard(string country, string metric, int limit,
            string scope = "global", int viewerId = 0)
        {
            // Whitelist metric -> aggregate expression. ALL metrics are weekly
            // (last 7 days) so the four leaderboards are directly comparable and
            // reset every week (item 10).
            string agg;
            const string dateFilter = "AND al.StartTime >= DATEADD(DAY, -7, SYSUTCDATETIME())";
            switch (metric)
            {
                case "distance_total": agg = "SUM(CASE WHEN al.IsConfirmed = 1 THEN ISNULL(al.DistanceKM, 0) ELSE 0 END)"; break;
                case "duration_total": agg = "SUM(CASE WHEN al.IsConfirmed = 1 THEN al.Duration ELSE 0 END)"; break;
                case "calories_total": agg = "SUM(CASE WHEN al.IsConfirmed = 1 THEN ISNULL(al.CaloriesBurned, 0) ELSE 0 END)"; break;
                case "load_weekly":
                default:
                    agg = "SUM(CASE WHEN al.IsConfirmed = 1 THEN al.CalculatedLoadForSession ELSE 0 END)";
                    break;
            }

            // #170 — friends-only scope restricts to the viewer + their accepted
            // friends and drops the country filter (friends are friends anywhere).
            bool friends = string.Equals(scope, "friends", StringComparison.OrdinalIgnoreCase) && viewerId > 0;
            string countryFilter = friends ? "" : "AND ISNULL(u.Country, 'IL') = @country";
            string scopeFilter = friends
                ? @"AND (u.UserID = @viewer OR u.UserID IN (
                        SELECT AddresseeID FROM dbo.Friendships WHERE RequesterID = @viewer AND Status = 'accepted'
                        UNION
                        SELECT RequesterID FROM dbo.Friendships WHERE AddresseeID = @viewer AND Status = 'accepted'))"
                : "";

            var list = new List<LeaderboardEntry>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand($@"
SELECT TOP (@limit)
       u.UserID, u.FullName, u.ProfileImagePath, u.EquippedBadge, u.EquippedTitle, u.EquippedFrame, u.ExperienceLevel,
       {agg} AS MetricValue
FROM dbo.Users u
JOIN dbo.ActivityLogs al ON al.UserID = u.UserID {dateFilter}
WHERE u.IsOnLeaderboard = 1 {countryFilter} {scopeFilter}
GROUP BY u.UserID, u.FullName, u.ProfileImagePath, u.EquippedBadge, u.EquippedTitle, u.EquippedFrame, u.ExperienceLevel
HAVING {agg} > 0
ORDER BY MetricValue DESC;", con);
            cmd.Parameters.AddWithValue("@country", country);
            cmd.Parameters.AddWithValue("@limit", limit);
            if (friends) cmd.Parameters.AddWithValue("@viewer", viewerId);
            using var r = cmd.ExecuteReader();
            int rank = 0;
            while (r.Read())
            {
                rank++;
                list.Add(new LeaderboardEntry
                {
                    Rank = rank,
                    UserID = Int(r, "UserID"),
                    FullName = Str(r, "FullName"),
                    ProfileImagePath = Str(r, "ProfileImagePath"),
                    EquippedBadge = Str(r, "EquippedBadge"),
                    EquippedTitle = Str(r, "EquippedTitle"),
                    EquippedFrame = Str(r, "EquippedFrame"),
                    ExperienceLevel = Int(r, "ExperienceLevel"),
                    MetricValue = Dbl(r, "MetricValue"),
                });
            }
            return list;
        }

        // ── #143 comments ───────────────────────────────────────────────────
        public BoardComment AddComment(int postId, int userId, int? parentCommentId, string text)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
INSERT INTO dbo.WorkoutPostComments (PostId, UserID, ParentCommentId, [Text])
OUTPUT INSERTED.CommentId, INSERTED.PostId, INSERTED.UserID, INSERTED.ParentCommentId,
       INSERTED.[Text], INSERTED.CreatedAt
VALUES (@p, @u, @parent, @t);", con);
            cmd.Parameters.AddWithValue("@p", postId);
            cmd.Parameters.AddWithValue("@u", userId);
            cmd.Parameters.AddWithValue("@parent", (object?)parentCommentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@t", text);
            using var r = cmd.ExecuteReader();
            if (!r.Read()) return null;
            return new BoardComment
            {
                CommentId = Int(r, "CommentId"),
                PostId = Int(r, "PostId"),
                UserID = Int(r, "UserID"),
                ParentCommentId = r["ParentCommentId"] == DBNull.Value ? (int?)null : Int(r, "ParentCommentId"),
                Text = Str(r, "Text"),
                CreatedAt = (DateTime)r["CreatedAt"],
            };
        }

        public List<BoardComment> GetComments(int postId)
        {
            var list = new List<BoardComment>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT c.CommentId, c.PostId, c.UserID, c.ParentCommentId, c.[Text], c.CreatedAt,
       u.FullName AS AuthorName, u.ProfileImagePath AS AuthorImagePath
FROM dbo.WorkoutPostComments c
JOIN dbo.Users u ON u.UserID = c.UserID
WHERE c.PostId = @p
ORDER BY c.CreatedAt ASC, c.CommentId ASC;", con);
            cmd.Parameters.AddWithValue("@p", postId);
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                list.Add(new BoardComment
                {
                    CommentId = Int(r, "CommentId"),
                    PostId = Int(r, "PostId"),
                    UserID = Int(r, "UserID"),
                    ParentCommentId = r["ParentCommentId"] == DBNull.Value ? (int?)null : Int(r, "ParentCommentId"),
                    Text = Str(r, "Text"),
                    CreatedAt = (DateTime)r["CreatedAt"],
                    AuthorName = Str(r, "AuthorName"),
                    AuthorImagePath = Str(r, "AuthorImagePath"),
                });
            }
            return list;
        }

        public int? GetCommentOwner(int commentId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "SELECT UserID FROM dbo.WorkoutPostComments WHERE CommentId = @id;", con);
            cmd.Parameters.AddWithValue("@id", commentId);
            var v = cmd.ExecuteScalar();
            return v == null || v == DBNull.Value ? (int?)null : Convert.ToInt32(v);
        }

        public void DeleteComment(int commentId)
        {
            using SqlConnection con = Connect();
            // Replies first (self-FK can't cascade in SQL Server), then the comment.
            using SqlCommand cmd = new SqlCommand(@"
DELETE FROM dbo.WorkoutPostComments WHERE ParentCommentId = @id;
DELETE FROM dbo.WorkoutPostComments WHERE CommentId = @id;", con);
            cmd.Parameters.AddWithValue("@id", commentId);
            cmd.ExecuteNonQuery();
        }
    }
}
