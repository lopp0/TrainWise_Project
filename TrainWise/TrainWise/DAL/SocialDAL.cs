using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    // Data access for the social layer (#3): presence heartbeat, location,
    // nearby-user discovery, mini profiles, friendships, and coach offers.
    public class SocialDAL : DBservice
    {
        // ── helpers ──────────────────────────────────────────────────────
        private static bool Has(SqlDataReader r, string col)
        {
            for (int i = 0; i < r.FieldCount; i++)
                if (string.Equals(r.GetName(i), col, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }
        private static string Str(SqlDataReader r, string c) => r[c] == DBNull.Value ? null : r[c].ToString();
        private static int Int(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToInt32(r[c]);
        private static double Dbl(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToDouble(r[c]);
        private static bool Bool(SqlDataReader r, string c) => r[c] != DBNull.Value && Convert.ToBoolean(r[c]);
        private static DateTime? Dt(SqlDataReader r, string c) => r[c] == DBNull.Value ? (DateTime?)null : Convert.ToDateTime(r[c]);

        // ── presence / location ──────────────────────────────────────────
        public void UpdateLastSeen(int userId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserID", userId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpdateLastSeen", con, p);
            cmd.ExecuteNonQuery();
        }

        public void UpdateLocation(int userId, double lat, double lng)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@UserID", userId }, { "@Latitude", lat }, { "@Longitude", lng }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpdateUserLocation", con, p);
            cmd.ExecuteNonQuery();
        }

        // A-2: opt in/out of sharing live location on the Connect map.
        public void SetShareLiveLocation(int userId, bool share)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserID", userId }, { "@Share", share } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_SetShareLiveLocation", con, p);
            cmd.ExecuteNonQuery();
        }

        // ── nearby / mini profile ────────────────────────────────────────
        public List<NearbyUser> GetNearbyUsers(int userId, double lat, double lng, double radiusKm)
        {
            var list = new List<NearbyUser>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@UserID", userId }, { "@Latitude", lat }, { "@Longitude", lng }, { "@RadiusKm", radiusKm }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetNearbyUsers", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
            {
                list.Add(new NearbyUser
                {
                    UserID = Int(r, "UserID"),
                    FullName = Str(r, "FullName"),
                    ProfileImagePath = Str(r, "ProfileImagePath"),
                    ExperienceLevel = Int(r, "ExperienceLevel"),
                    IsCoach = Bool(r, "IsCoach"),
                    IsTrainee = Bool(r, "IsTrainee"),
                    Latitude = Dbl(r, "Latitude"),
                    Longitude = Dbl(r, "Longitude"),
                    LastSeen = Dt(r, "LastSeen"),
                    IsOnline = Bool(r, "IsOnline"),
                    ShareLiveLocation = Has(r, "ShareLiveLocation") && Bool(r, "ShareLiveLocation"),
                    DistanceKm = Dbl(r, "DistanceKm")
                });
            }
            return list;
        }

        public UserMiniProfile GetUserMiniProfile(int viewerId, int targetId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@ViewerID", viewerId }, { "@TargetID", targetId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetUserMiniProfile", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            if (r.Read())
            {
                return new UserMiniProfile
                {
                    UserID = Int(r, "UserID"),
                    FullName = Str(r, "FullName"),
                    ProfileImagePath = Str(r, "ProfileImagePath"),
                    ExperienceLevel = Int(r, "ExperienceLevel"),
                    IsCoach = Bool(r, "IsCoach"),
                    IsTrainee = Bool(r, "IsTrainee"),
                    LastSeen = Dt(r, "LastSeen"),
                    IsOnline = Bool(r, "IsOnline"),
                    TopActivities = Str(r, "TopActivities"),
                    FriendStatus = Str(r, "FriendStatus"),
                    FriendRequesterID = r["FriendRequesterID"] == DBNull.Value ? (int?)null : Convert.ToInt32(r["FriendRequesterID"]),
                    FriendshipID = r["FriendshipID"] == DBNull.Value ? (int?)null : Convert.ToInt32(r["FriendshipID"])
                };
            }
            return null;
        }

        // ── friendships ──────────────────────────────────────────────────
        private static Friendship MapFriendship(SqlDataReader r) => new Friendship
        {
            FriendshipID = Int(r, "FriendshipID"),
            RequesterID = Int(r, "RequesterID"),
            AddresseeID = Int(r, "AddresseeID"),
            Status = Str(r, "Status"),
            CreatedAt = Has(r, "CreatedAt") && r["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(r["CreatedAt"]) : default,
            RespondedAt = Has(r, "RespondedAt") ? Dt(r, "RespondedAt") : null
        };

        public Friendship SendFriendRequest(int requesterId, int addresseeId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@RequesterID", requesterId }, { "@AddresseeID", addresseeId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_SendFriendRequest", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            return r.Read() ? MapFriendship(r) : null;
        }

        public Friendship RespondFriendRequest(int friendshipId, bool accept)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@FriendshipID", friendshipId }, { "@Accept", accept } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_RespondFriendRequest", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            return r.Read() ? MapFriendship(r) : null;
        }

        private List<FriendContact> ReadFriendContacts(string sp, int userId)
        {
            var list = new List<FriendContact>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserID", userId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure(sp, con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
            {
                list.Add(new FriendContact
                {
                    FriendUserID = Int(r, "FriendUserID"),
                    FullName = Str(r, "FullName"),
                    Email = Str(r, "Email"),
                    ProfileImagePath = Str(r, "ProfileImagePath"),
                    ExperienceLevel = Int(r, "ExperienceLevel"),
                    LastSeen = Dt(r, "LastSeen"),
                    IsOnline = Bool(r, "IsOnline"),
                    FriendshipID = Int(r, "FriendshipID")
                });
            }
            return list;
        }

        public List<FriendContact> GetFriends(int userId) => ReadFriendContacts("sp_GetFriends", userId);
        public List<FriendContact> GetPendingFriendRequests(int userId) => ReadFriendContacts("sp_GetPendingFriendRequests", userId);

        public void RemoveFriend(int userA, int userB)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserA", userA }, { "@UserB", userB } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_RemoveFriend", con, p);
            cmd.ExecuteNonQuery();
        }

        // ── coach offers ─────────────────────────────────────────────────
        private static CoachOffer MapCoachOffer(SqlDataReader r) => new CoachOffer
        {
            OfferID = Int(r, "OfferID"),
            CoachUserID = Int(r, "CoachUserID"),
            TraineeUserID = Int(r, "TraineeUserID"),
            Status = Str(r, "Status"),
            CreatedAt = Has(r, "CreatedAt") && r["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(r["CreatedAt"]) : default,
            RespondedAt = Has(r, "RespondedAt") ? Dt(r, "RespondedAt") : null
        };

        public CoachOffer SendCoachOffer(int coachUserId, int traineeUserId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@CoachUserID", coachUserId }, { "@TraineeUserID", traineeUserId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_SendCoachOffer", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            return r.Read() ? MapCoachOffer(r) : null;
        }

        public CoachOffer RespondCoachOffer(int offerId, bool accept)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@OfferID", offerId }, { "@Accept", accept } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_RespondCoachOffer", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            return r.Read() ? MapCoachOffer(r) : null;
        }

        public List<CoachOfferContact> GetCoachOffersForTrainee(int traineeUserId)
        {
            var list = new List<CoachOfferContact>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@TraineeUserID", traineeUserId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetCoachOffersForTrainee", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
            {
                list.Add(new CoachOfferContact
                {
                    OfferID = Int(r, "OfferID"),
                    CoachUserID = Int(r, "CoachUserID"),
                    FullName = Str(r, "FullName"),
                    Email = Str(r, "Email"),
                    ProfileImagePath = Str(r, "ProfileImagePath"),
                    ExperienceLevel = Int(r, "ExperienceLevel"),
                    CreatedAt = Has(r, "CreatedAt") && r["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(r["CreatedAt"]) : default
                });
            }
            return list;
        }

        public List<CoachOffer> GetSentCoachOffers(int coachUserId)
        {
            var list = new List<CoachOffer>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@CoachUserID", coachUserId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetSentCoachOffers", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
            {
                list.Add(new CoachOffer
                {
                    OfferID = Int(r, "OfferID"),
                    TraineeUserID = Int(r, "TraineeUserID"),
                    CoachUserID = coachUserId,
                    Status = Str(r, "Status"),
                    CreatedAt = Has(r, "CreatedAt") && r["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(r["CreatedAt"]) : default
                });
            }
            return list;
        }
    }
}
