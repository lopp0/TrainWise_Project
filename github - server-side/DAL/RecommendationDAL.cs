using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;


namespace TrainWise.DAL
{
    public class RecommendationDAL : DBservice
    {
        public int InsertRecommendation(Recommendation r)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserID", r.UserID},
                    {"@Date", r.Date},
                    {"@LoadLevel", r.LoadLevel},
                    {"@RecommendationText", r.RecommendationText},
                    {"@Type", r.Type}
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InsertRecommendation", con, param))
                {
                    object id = cmd.ExecuteScalar();
                    return Convert.ToInt32(id);
                }
            }
        }

        public List<Recommendation> GetByUser(int userId)
        {
            var list = new List<Recommendation>();
            using (SqlConnection con = Connect())
            using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetRecommendationsByUser", con, new Dictionary<string, object> { { "@UserID", userId } }))
            using (SqlDataReader reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    list.Add(new Recommendation
                    {
                        RecID = (int)reader["RecID"],
                        UserID = (int)reader["UserID"],
                        Date = (DateTime)reader["Date"],
                        LoadLevel = reader["LoadLevel"].ToString(),
                        RecommendationText = reader["RecommendationText"].ToString(),
                        Type = reader["Type"].ToString()
                    });
                }
            }
            return list;
        }
    }
}
