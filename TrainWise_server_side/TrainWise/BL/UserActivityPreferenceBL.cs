using TrainWise.DAL;

namespace TrainWise.BL
{
    public class UserActivityPreferenceBL
    {
        private readonly UserActivityPreferenceDAL _dal = new UserActivityPreferenceDAL();

        public void AddPreference(int userId, int activityTypeId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            if (activityTypeId <= 0) throw new ArgumentException("ActivityTypeID must be positive");

            _dal.AddPreference(userId, activityTypeId);
        }

        public void RemovePreference(int userId, int activityTypeId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            if (activityTypeId <= 0) throw new ArgumentException("ActivityTypeID must be positive");

            _dal.RemovePreference(userId, activityTypeId);
        }
    }
}
