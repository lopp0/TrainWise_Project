using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // A-3 — Workout Board + Leaderboard business logic.
    public class BoardBL
    {
        private readonly BoardDAL _dal = new BoardDAL();

        public List<WorkoutPost> GetFeed(int viewerId, string country, int page, int limit)
        {
            if (string.IsNullOrWhiteSpace(country)) country = "IL";
            if (limit <= 0 || limit > 100) limit = 20;
            if (page < 0) page = 0;
            return _dal.GetFeed(viewerId, country, page, limit);
        }

        public int Create(WorkoutPost p)
        {
            if (p.UserID <= 0) throw new ArgumentException("UserID is required");
            if (string.IsNullOrWhiteSpace(p.Title)) throw new ArgumentException("Title is required");
            return _dal.Insert(p);
        }

        public void Delete(int postId, int userId)
        {
            if (postId <= 0 || userId <= 0) throw new ArgumentException("Invalid ids");
            _dal.Delete(postId, userId);
        }

        public bool ToggleLike(int postId, int userId)
        {
            if (postId <= 0 || userId <= 0) throw new ArgumentException("Invalid ids");
            return _dal.ToggleLike(postId, userId);
        }

        public void SetLeaderboardOptIn(int userId, bool on)
        {
            if (userId <= 0) throw new ArgumentException("UserID is required");
            _dal.SetLeaderboardOptIn(userId, on);
        }

        public List<LeaderboardEntry> GetLeaderboard(string country, string metric, int limit)
        {
            if (string.IsNullOrWhiteSpace(country)) country = "IL";
            if (limit <= 0 || limit > 200) limit = 50;
            return _dal.GetLeaderboard(country, metric ?? "load_weekly", limit);
        }
    }
}
