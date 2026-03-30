using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class DailyLoadBL
    {
        private DailyLoadDAL _dal = null!;
        private UserDAL _userDal = null!;

        public DailyLoadBL()
        {
            _dal = new DailyLoadDAL();
            _userDal = new UserDAL();
        }

        public (double acute, double chronic, double? acRatio, int stressScore, string loadLevel)
            CalculateForDay(int userId, DateTime date)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            if (_userDal.GetUserById(userId) == null)
                throw new ArgumentException("User does not exist");

            if (date.Date > DateTime.Today)
                throw new ArgumentException("Date cannot be in the future");

            return _dal.CalculateDailyLoad(userId, date);
        }

        public List<DailyLoad> GetByUser(int userId)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            return _dal.GetDailyLoadByUser(userId);
        }
    }
}
