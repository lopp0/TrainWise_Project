using Microsoft.Data.SqlClient;

namespace TrainWise.DAL
{
    public class CoachTraineeDAL : DBservice
    {
        public void Connect(int coachId, int userId)
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

        public void Disconnect(int coachId, int userId)
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
