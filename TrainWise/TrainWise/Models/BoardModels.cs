namespace TrainWise.BL.Models
{
    // A-3 — Workout Board + Leaderboard.
    public class WorkoutPost
    {
        public int PostId { get; set; }
        public int UserID { get; set; }
        public int? ActivityLogId { get; set; }
        public string PostType { get; set; } = "record";
        public string Title { get; set; }
        public string Description { get; set; }
        public string MetricType { get; set; }
        public double? MetricValue { get; set; }
        public string ImagePath { get; set; }   // item 9 — optional photo
        public bool IsPublic { get; set; } = true;
        public string Country { get; set; }
        public DateTime CreatedAt { get; set; }

        // Author projection (joined from Users) + like state for the viewer.
        public string AuthorName { get; set; }
        public string AuthorImagePath { get; set; }
        public string EquippedBadge { get; set; }
        public string EquippedTitle { get; set; }
        public string EquippedFrame { get; set; }
        public int LikeCount { get; set; }
        public bool LikedByMe { get; set; }
        public string FriendStatus { get; set; } // null | pending | accepted | declined (viewer↔author)
    }

    public class CreateWorkoutPostRequest
    {
        public int UserID { get; set; }
        public int? ActivityLogId { get; set; }
        public string PostType { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string MetricType { get; set; }
        public double? MetricValue { get; set; }
        public string ImagePath { get; set; }   // item 9 — optional photo
        public bool IsPublic { get; set; } = true;
    }

    public class LeaderboardEntry
    {
        public int Rank { get; set; }
        public int UserID { get; set; }
        public string FullName { get; set; }
        public string ProfileImagePath { get; set; }
        public string EquippedBadge { get; set; }
        public string EquippedTitle { get; set; }
        public string EquippedFrame { get; set; }
        public int ExperienceLevel { get; set; }
        public double MetricValue { get; set; }
    }
}
