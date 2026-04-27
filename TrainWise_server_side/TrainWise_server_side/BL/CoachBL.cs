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

        public List<DailyLoad> GetTraineeLoad(int coachId, int userId)
        {
            if (coachId <= 0) throw new ArgumentException("CoachID must be positive");
            if (userId <= 0) throw new ArgumentException("UserID must be positive");

            var coach = _coachDal.GetCoachById(coachId);
            if (coach == null)
                throw new ArgumentException("Coach does not exist");

            return _coachDal.GetTraineeLoadHistory(coachId, userId);
        }
    }
}
