using Microsoft.Data.SqlClient;

namespace TrainWise.DAL
{
    public class UserActivityPreferenceDAL : DBservice
    {
        public void AddPreference(int userId, int activityTypeId)
        {
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_AddUserActivityPreference", con, new Dictionary<string, object> { { "@UserID", userId }, { "@ActivityTypeID", activityTypeId } }))
            {
                cmd.ExecuteNonQuery();
            }
        }

        public void RemovePreference(int userId, int activityTypeId)
        {
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_RemoveUserActivityPreference", con, new Dictionary<string, object> { { "@UserID", userId }, { "@ActivityTypeID", activityTypeId } }))
            {
                cmd.ExecuteNonQuery();
            }
        }
    }
}
