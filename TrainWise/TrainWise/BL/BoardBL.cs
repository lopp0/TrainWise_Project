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

        public List<LeaderboardEntry> GetLeaderboard(string country, string metric, int limit,
            string scope = "global", int viewerId = 0)
        {
            if (string.IsNullOrWhiteSpace(country)) country = "IL";
            if (limit <= 0 || limit > 200) limit = 50;
            return _dal.GetLeaderboard(country, metric ?? "load_weekly", limit, scope ?? "global", viewerId);
        }

        // #171 — toggle kudos on a workout, push-notify the owner on add,
        // and return the fresh count + the viewer's kudos state.
        public (int count, bool kudoed) ToggleKudos(int logId, int fromUserId)
        {
            if (logId <= 0 || fromUserId <= 0) throw new ArgumentException("Invalid ids");
            bool kudoed = _dal.ToggleKudos(logId, fromUserId);
            if (kudoed)
            {
                try
                {
                    int ownerId = _dal.GetActivityLogOwner(logId);
                    if (ownerId > 0 && ownerId != fromUserId)
                    {
                        var udal = new UserDAL();
                        var giver = udal.GetUserById(fromUserId);
                        var token = udal.GetPushToken(ownerId);
                        PushSender.Send(token, "New kudos 👏",
                            $"{giver?.FullName ?? "Someone"} cheered your workout!");
                    }
                }
                catch { /* best-effort notify */ }
            }
            return _dal.GetKudos(logId, fromUserId);
        }

        public (int count, bool kudoed) GetKudos(int logId, int viewerId)
        {
            if (logId <= 0) throw new ArgumentException("Invalid log id");
            return _dal.GetKudos(logId, viewerId);
        }

        // ── #143 comments ───────────────────────────────────────────────────
        public BoardComment AddComment(int postId, int userId, int? parentCommentId, string text)
        {
            if (postId <= 0) throw new ArgumentException("Invalid post id");
            if (userId <= 0) throw new ArgumentException("Invalid user id");
            if (string.IsNullOrWhiteSpace(text)) throw new ArgumentException("Comment can't be empty");
            text = text.Trim();
            if (text.Length > 500) text = text.Substring(0, 500);
            if (parentCommentId.HasValue && parentCommentId.Value <= 0) parentCommentId = null;
            return _dal.AddComment(postId, userId, parentCommentId, text);
        }

        public List<BoardComment> GetComments(int postId)
        {
            if (postId <= 0) throw new ArgumentException("Invalid post id");
            return _dal.GetComments(postId);
        }

        public int? GetCommentOwner(int commentId) => _dal.GetCommentOwner(commentId);

        public void DeleteComment(int commentId)
        {
            if (commentId <= 0) throw new ArgumentException("Invalid comment id");
            _dal.DeleteComment(commentId);
        }
    }
}
