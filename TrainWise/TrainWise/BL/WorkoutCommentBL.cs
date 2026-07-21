using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // #134 — coach comments on a workout. A comment may be posted by the log's
    // owner OR by a coach linked to the owner; nobody else can write.
    public class WorkoutCommentBL
    {
        private readonly WorkoutCommentDAL _dal = new WorkoutCommentDAL();
        private readonly UserDAL _userDal = new UserDAL();  // #134 — push to the trainee

        public List<WorkoutComment> GetComments(int activityId) => _dal.GetComments(activityId);

        public int AddComment(int activityId, int authorUserId, string text)
        {
            if (string.IsNullOrWhiteSpace(text)) throw new ArgumentException("Comment text is required");
            if (text.Length > 600) text = text.Substring(0, 600);
            int owner = _dal.GetLogOwner(activityId);
            if (owner == 0) throw new ArgumentException("Workout not found");
            bool allowed = authorUserId == owner || _dal.IsCoachOf(authorUserId, owner);
            if (!allowed) throw new ArgumentException("Only the athlete or their coach can comment on this workout");
            int id = _dal.AddComment(activityId, authorUserId, text.Trim());
            // Notify the athlete when the COACH leaves feedback (not on self-comments).
            if (authorUserId != owner)
                PushSender.Send(_userDal.GetPushToken(owner), "New coach feedback",
                    "Your coach left feedback on one of your workouts.");
            return id;
        }

        public void DeleteComment(int commentId) => _dal.DeleteComment(commentId);
        public int GetCommentAuthor(int commentId) => _dal.GetCommentAuthor(commentId);
    }
}
