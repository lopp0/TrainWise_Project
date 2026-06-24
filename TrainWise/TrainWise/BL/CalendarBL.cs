using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // A-4 — Training Calendar business logic.
    public class CalendarBL
    {
        private readonly CalendarDAL _dal = new CalendarDAL();
        private readonly UserDAL _userDal = new UserDAL();

        public List<PlannedWorkout> GetRange(int userId, DateTime from, DateTime to)
        {
            if (userId <= 0) throw new ArgumentException("UserID required");
            return _dal.GetRange(userId, from, to);
        }

        public int Create(PlannedWorkout p)
        {
            if (p.UserID <= 0) throw new ArgumentException("UserID required");
            int id = _dal.Insert(p);

            // Item 12 — when a COACH plans a workout for a trainee, push the
            // trainee so they're told even when the app is closed (best-effort).
            if (p.CreatedByCoach != null && p.CreatedByCoach > 0 && p.CreatedByCoach != p.UserID)
            {
                string when = p.PlannedDate.ToString("ddd, MMM d");
                PushSender.Send(_userDal.GetPushToken(p.UserID),
                    "New workout from your coach 🏋️",
                    $"Your coach planned a session for {when}. Open TrainWise to see it.");
            }

            return id;
        }

        public void Update(PlannedWorkout p)
        {
            if (p.PlanId <= 0) throw new ArgumentException("PlanId required");
            _dal.Update(p);
        }

        public void Delete(int planId)
        {
            if (planId <= 0) throw new ArgumentException("PlanId required");
            _dal.Delete(planId);
        }

        public void MarkComplete(int planId, int? linkedLogId)
        {
            if (planId <= 0) throw new ArgumentException("PlanId required");
            _dal.MarkComplete(planId, linkedLogId);
        }
    }
}
