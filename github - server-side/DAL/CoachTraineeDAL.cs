using Microsoft.Data.SqlClient;

namespace TrainWise.DAL
{
    public class CoachTraineeDAL : DBservice
    {
        public void ConnectTrainee(int coachId, int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@CoachID", coachId},
                    {"@UserID", userId}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_ConnectTraineeToCoach", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void DisconnectTrainee(int coachId, int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@CoachID", coachId},
                    {"@UserID", userId}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_DisconnectTrainee", con, param))
                {
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}
