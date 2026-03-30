using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class RecommendationBL
    {

        private RecommendationDAL _dal = null!;
        private UserDAL _userDal = null!;

        public RecommendationBL()
        {
            _dal = new RecommendationDAL();
            _userDal = new UserDAL();
        }

        public int Create(Recommendation r)
        {
            if (r.UserID <= 0)
                throw new ArgumentException("UserID is required");

            if (_userDal.GetUserById(r.UserID) == null)
                throw new ArgumentException("User does not exist");

            if (r.Date > DateTime.Today)
                throw new ArgumentException("Date cannot be in the future");

            if (string.IsNullOrWhiteSpace(r.LoadLevel))
                throw new ArgumentException("LoadLevel is required");

            if (string.IsNullOrWhiteSpace(r.RecommendationText))
                throw new ArgumentException("RecommendationText is required");

            if (string.IsNullOrWhiteSpace(r.Type))
                throw new ArgumentException("Type is required");

            return _dal.InsertRecommendation(r);
        }

        public List<Recommendation> GetByUser(int userId)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            return _dal.GetByUser(userId);
        }


    }
}
