using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class TrainingGoalCatalogBL
    {
        private readonly TrainingGoalDAL _dal = new TrainingGoalDAL();

        public List<TrainingGoal> GetAll()
        {
            return _dal.GetAll();
        }
    }
}
