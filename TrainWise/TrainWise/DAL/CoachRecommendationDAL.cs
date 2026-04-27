using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    public class CoachRecommendationDAL : DBservice
    {
        public int Insert(CoachRecommendation r)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@CoachID", r.CoachID},
                    {"@UserID", r.UserID},
                    {"@Date", r.Date},
                    {"@Title", r.Title},
                    {"@Text", r.Text}
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InsertCoachRecommendation", con, param))
                {
                    object id = cmd.ExecuteScalar();
                    return Convert.ToInt32(id);
                }
            }
        }

        public List<CoachRecommendation> GetByUser(int userId)
        {
            var list = new List<CoachRecommendation>();
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetCoachRecommendationsByUser", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new CoachRecommendation
                        {
                            RecID = (int)reader["RecID"],
                            CoachID = (int)reader["CoachID"],
                            UserID = (int)reader["UserID"],
                            Date = (DateTime)reader["Date"],
                            Title = reader["Title"].ToString(),
                            Text = reader["Text"].ToString()
                        });
                    }
                }
            }
            return list;
        }
    }
}
