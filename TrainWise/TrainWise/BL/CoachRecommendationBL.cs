using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class CoachRecommendationBL
    {
        private readonly CoachRecommendationDAL _dal = new CoachRecommendationDAL();
        private readonly CoachDAL _coachDal = new CoachDAL();
        private readonly UserDAL _userDal = new UserDAL();

        public int Create(CoachRecommendation r)
        {
            if (r.CoachID <= 0) throw new ArgumentException("CoachID is required");
            if (r.UserID <= 0) throw new ArgumentException("UserID is required");
            if (string.IsNullOrWhiteSpace(r.Title)) throw new ArgumentException("Title is required");
            if (string.IsNullOrWhiteSpace(r.Text)) throw new ArgumentException("Text is required");

            if (_coachDal.GetCoachById(r.CoachID) == null)
                throw new ArgumentException("Coach does not exist");

            if (_userDal.GetUserById(r.UserID) == null)
                throw new ArgumentException("User does not exist");

            if (r.Date == default)
                r.Date = DateTime.Today;

            return _dal.Insert(r);
        }

        public List<CoachRecommendation> GetByUser(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            return _dal.GetByUser(userId);
        }
    }
}
