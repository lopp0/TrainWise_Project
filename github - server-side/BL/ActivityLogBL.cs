using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class ActivityLogBL
    {
        private readonly ActivityLogDAL _dal;
        private readonly UserDAL _userDal;

        public ActivityLogBL()
        {
            _dal = new ActivityLogDAL();
            _userDal = new UserDAL();
        }

        public int Create(ActivityLog log)
        {
            if (log.UserID <= 0) throw new ArgumentException("UserID required");
            if (log.ActivityTypeID <= 0) throw new ArgumentException("ActivityTypeID required");
            if (log.StartTime >= log.EndTime) throw new ArgumentException("Start Time must be before End Time");
            if (log.DistanceKM < 0) throw new ArgumentException("DistanceKM must be 0 or greater");
            if (log.ExertionLevel < 1 || log.ExertionLevel > 10)
                throw new ArgumentException("ExertionLevel must be between 1 and 10");
            if (log.Duration <= 0)
                throw new ArgumentException("Duration must be positive");


            if (_userDal.GetUserById(log.UserID) == null)
                throw new ArgumentException("User not found");

            log.CalculatedLoadForSession = (short)(log.Duration * log.ExertionLevel);

            return _dal.Insert(log);
        }

        public void Update(ActivityLog log)
        {
            if (log.ActivityID <= 0) throw new ArgumentException("ActivityID required");
            if (log.StartTime >= log.EndTime) throw new ArgumentException("Start Time must be before End Time");
            if (log.ExertionLevel < 1 || log.ExertionLevel > 10)
                throw new ArgumentException("ExertionLevel must be between 1 and 10");
            if (log.Duration <= 0)
                throw new ArgumentException("Duration must be positive");

            log.CalculatedLoadForSession = (short)(log.Duration * log.ExertionLevel);


            _dal.Update(log);
        }

        public void Delete(int activityId)
        {
            if (activityId <= 0) throw new ArgumentException("ActivityID > 0");
            _dal.Delete(activityId);
        }

        public List<ActivityLog> GetByUser(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID > 0");
            return _dal.GetByUser(userId);
        }
    }
}

