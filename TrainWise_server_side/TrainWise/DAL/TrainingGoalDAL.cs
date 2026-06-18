using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    public class TrainingGoalDAL : DBservice
    {
        public List<TrainingGoal> GetAll()
        {
            var list = new List<TrainingGoal>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetAllTrainingGoals", con, null))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    list.Add(new TrainingGoal
                    {
                        GoalID = (int)reader["GoalID"],
                        GoalName = reader["GoalName"].ToString()
                    });
                }
            }
            return list;
        }
    }
}
