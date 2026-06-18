using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    public class ActivityTypeDAL : DBservice
    {
        public List<ActivityType> GetAll()
        {
            var list = new List<ActivityType>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetAllActivityTypes", con, null))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    list.Add(new ActivityType
                    {
                        ActivityTypeID = (int)reader["ActivityTypeID"],
                        TypeName = reader["TypeName"].ToString()
                    });
                }
            }
            return list;
        }

        public int Insert(string typeName)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@TypeName", typeName } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InsertActivityType", con, param))
                {
                    object res = cmd.ExecuteScalar();
                    return Convert.ToInt32(res);
                }
            }
        }
    }
}
