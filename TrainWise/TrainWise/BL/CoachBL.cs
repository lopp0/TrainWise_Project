using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class CoachBL
    {
        private readonly CoachDAL _coachDal = new CoachDAL();

        public List<TraineeSummary> GetTrainees(int coachId)
        {
            if (coachId <= 0)
                throw new ArgumentException("CoachID must be positive");

            var coach = _coachDal.GetCoachById(coachId);
            if (coach == null)
                throw new ArgumentException("Coach does not exist");

            return _coachDal.GetTraineesWithLoad(coachId);
        }

        public Coach GetCoachByUserId(int userId)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            var coach = _coachDal.GetCoachByUserId(userId);
            if (coach != null)
                return coach;

            // Lazy-create: users who became a coach AFTER signup never got a
            // Coaches row (UserBL.Create only inserts one when IsCoach=true at
            // signup time). Rather than 404 the QR Connect flow forever, create
            // the row on first read if the user is genuinely a coach.
            var user = new UserBL().GetById(userId);
            if (user == null)
                throw new ArgumentException("No coach profile exists for this user");
            if (!user.IsCoach)
                throw new ArgumentException("This user is not registered as a coach");

            _coachDal.InsertCoach(userId, user.FullName, user.Email);

            var created = _coachDal.GetCoachByUserId(userId);
            if (created == null)
                throw new ArgumentException("Failed to create coach profile");

            return created;
        }

        public List<DailyLoad> GetTraineeLoad(int coachId, int userId)
        {
            if (coachId <= 0) throw new ArgumentException("CoachID must be positive");
            if (userId <= 0) throw new ArgumentException("UserID must be positive");

            var coach = _coachDal.GetCoachById(coachId);
            if (coach == null)
                throw new ArgumentException("Coach does not exist");

            return _coachDal.GetTraineeLoadHistory(coachId, userId);
        }

        public List<CoachContact> GetCoachesForTrainee(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            return _coachDal.GetCoachesForTrainee(userId);
        }
    }
}
