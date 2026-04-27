using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class ActivityTypeBL
    {
        private readonly ActivityTypeDAL _dal = new ActivityTypeDAL();

        public List<ActivityType> GetAll()
        {
            return _dal.GetAll();
        }
    }
}
