using TrainWise.DAL;

namespace TrainWise.BL
{
    public class UserTrainingGoalBL
    {
        private readonly UserTrainingGoalDAL _dal = new UserTrainingGoalDAL();

        public void AddGoal(int userId, int goalId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            if (goalId <= 0) throw new ArgumentException("GoalID must be positive");

            _dal.AddGoal(userId, goalId);
        }

        public void RemoveGoal(int userId, int goalId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            if (goalId <= 0) throw new ArgumentException("GoalID must be positive");

            _dal.RemoveGoal(userId, goalId);
        }
    }
}

