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

        public void SetLeaderboardOptIn(int userId, bool on)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                "UPDATE dbo.Users SET IsOnLeaderboard = @on WHERE UserID = @u", con);
            cmd.Parameters.AddWithValue("@u", userId);
            cmd.Parameters.AddWithValue("@on", on);
            cmd.ExecuteNonQuery();
        }

        public List<LeaderboardEntry> GetLeaderboard(string country, string metric, int limit)
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

            var list = new List<LeaderboardEntry>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand($@"
SELECT TOP (@limit)
       u.UserID, u.FullName, u.ProfileImagePath, u.EquippedBadge, u.EquippedTitle, u.EquippedFrame, u.ExperienceLevel,
       {agg} AS MetricValue
FROM dbo.Users u
JOIN dbo.ActivityLogs al ON al.UserID = u.UserID {dateFilter}
WHERE u.IsOnLeaderboard = 1 AND ISNULL(u.Country, 'IL') = @country
GROUP BY u.UserID, u.FullName, u.ProfileImagePath, u.EquippedBadge, u.EquippedTitle, u.EquippedFrame, u.ExperienceLevel
HAVING {agg} > 0
ORDER BY MetricValue DESC;", con);
            cmd.Parameters.AddWithValue("@country", country);
            cmd.Parameters.AddWithValue("@limit", limit);
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
    }
}
