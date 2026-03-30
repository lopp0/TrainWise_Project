using Microsoft.Data.SqlClient;

namespace TrainWise.DAL
{
    public class UserTrainingGoalDAL : DBservice
    {
        public void AddGoal(int userId, int goalId)
        {
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_AddUserTrainingGoal", con, new Dictionary<string, object> { { "@UserID", userId }, { "@GoalID", goalId } }))
            {
                cmd.ExecuteNonQuery();
            }
        }

        public void RemoveGoal(int userId, int goalId)
        {
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_RemoveUserTrainingGoal", con, new Dictionary<string, object> { { "@UserID", userId }, { "@GoalID", goalId } }))
            {
                cmd.ExecuteNonQuery();
            }
        }
    }
}
