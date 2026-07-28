using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    // Data access for gyms + the gym↔coach recommendation links (#3).
    public class GymDAL : DBservice
    {
        private static string Str(SqlDataReader r, string c) => r[c] == DBNull.Value ? null : r[c].ToString();
        private static int Int(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToInt32(r[c]);
        private static double Dbl(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToDouble(r[c]);
        private static bool Bool(SqlDataReader r, string c) => r[c] != DBNull.Value && Convert.ToBoolean(r[c]);
        private static DateTime? Dt(SqlDataReader r, string c) => r[c] == DBNull.Value ? (DateTime?)null : Convert.ToDateTime(r[c]);
        private static decimal? Dec(SqlDataReader r, string c) => r[c] == DBNull.Value ? (decimal?)null : Convert.ToDecimal(r[c]);

        public List<Gym> GetGyms(double lat, double lng, double radiusKm)
        {
            var list = new List<Gym>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@Latitude", lat }, { "@Longitude", lng }, { "@RadiusKm", radiusKm }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetGyms", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
            {
                list.Add(new Gym
                {
                    GymID = Int(r, "GymID"),
                    Name = Str(r, "Name"),
                    Address = Str(r, "Address"),
                    City = Str(r, "City"),
                    Latitude = Dbl(r, "Latitude"),
                    Longitude = Dbl(r, "Longitude"),
                    Description = Str(r, "Description"),
                    Rating = Dec(r, "Rating"),
                    Phone = Str(r, "Phone"),
                    PhotoPath = Str(r, "PhotoPath"),
                    DistanceKm = Dbl(r, "DistanceKm"),
                    CoachCount = Int(r, "CoachCount")
                });
            }
            return list;
        }

        public List<GymCoachContact> GetGymCoaches(int gymId)
        {
            var list = new List<GymCoachContact>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@GymID", gymId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetGymCoaches", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
            {
                list.Add(new GymCoachContact
                {
                    UserID = Int(r, "UserID"),
                    FullName = Str(r, "FullName"),
                    Email = Str(r, "Email"),
                    ProfileImagePath = Str(r, "ProfileImagePath"),
                    ExperienceLevel = Int(r, "ExperienceLevel"),
                    LastSeen = Dt(r, "LastSeen"),
                    IsOnline = Bool(r, "IsOnline")
                });
            }
            return list;
        }

        public void AddCoachToGym(int gymId, int coachUserId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@GymID", gymId }, { "@CoachUserID", coachUserId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_AddCoachToGym", con, p);
            cmd.ExecuteNonQuery();
        }

        public void RemoveCoachFromGym(int gymId, int coachUserId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@GymID", gymId }, { "@CoachUserID", coachUserId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_RemoveCoachFromGym", con, p);
            cmd.ExecuteNonQuery();
        }

        public List<GymRef> GetGymsForCoach(int coachUserId)
        {
            var list = new List<GymRef>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@CoachUserID", coachUserId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetGymsForCoach", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
            {
                list.Add(new GymRef
                {
                    GymID = Int(r, "GymID"),
                    Name = Str(r, "Name"),
                    Address = Str(r, "Address"),
                    Latitude = Dbl(r, "Latitude"),
                    Longitude = Dbl(r, "Longitude")
                });
            }
            return list;
        }
    }
}
