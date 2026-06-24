using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // Business logic for the social layer (#3): presence, location, nearby
    // discovery, friendships, coach offers.
    public class SocialBL
    {
        private readonly SocialDAL _dal = new SocialDAL();

        // ── presence / location ──────────────────────────────────────────
        public void UpdateLastSeen(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            _dal.UpdateLastSeen(userId);
        }

        public void UpdateLocation(int userId, double lat, double lng)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            if (lat < -90 || lat > 90) throw new ArgumentException("Latitude out of range");
            if (lng < -180 || lng > 180) throw new ArgumentException("Longitude out of range");
            _dal.UpdateLocation(userId, lat, lng);
        }

        // A-2: set live-location sharing opt-in.
        public void SetShareLiveLocation(int userId, bool share)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            _dal.SetShareLiveLocation(userId, share);
        }

        // ── nearby / profile ─────────────────────────────────────────────
        public List<NearbyUser> GetNearbyUsers(int userId, double lat, double lng, double radiusKm)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            if (radiusKm <= 0) radiusKm = 25;
            if (radiusKm > 200) radiusKm = 200;
            return _dal.GetNearbyUsers(userId, lat, lng, radiusKm);
        }

        public UserMiniProfile GetUserMiniProfile(int viewerId, int targetId)
        {
            if (viewerId <= 0 || targetId <= 0) throw new ArgumentException("Both user ids must be positive");
            var profile = _dal.GetUserMiniProfile(viewerId, targetId);
            if (profile == null) throw new ArgumentException("User not found");
            return profile;
        }

        // ── friendships ──────────────────────────────────────────────────
        public Friendship SendFriendRequest(int requesterId, int addresseeId)
        {
            if (requesterId <= 0 || addresseeId <= 0) throw new ArgumentException("Both user ids must be positive");
            if (requesterId == addresseeId) throw new ArgumentException("You cannot add yourself");
            return _dal.SendFriendRequest(requesterId, addresseeId);
        }

        public Friendship RespondFriendRequest(int friendshipId, bool accept)
        {
            if (friendshipId <= 0) throw new ArgumentException("FriendshipID must be positive");
            return _dal.RespondFriendRequest(friendshipId, accept);
        }

        public List<FriendContact> GetFriends(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            return _dal.GetFriends(userId);
        }

        public List<FriendContact> GetPendingFriendRequests(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            return _dal.GetPendingFriendRequests(userId);
        }

        public void RemoveFriend(int userA, int userB)
        {
            if (userA <= 0 || userB <= 0) throw new ArgumentException("Both user ids must be positive");
            _dal.RemoveFriend(userA, userB);
        }

        // ── coach offers ─────────────────────────────────────────────────
        public CoachOffer SendCoachOffer(int coachUserId, int traineeUserId)
        {
            if (coachUserId <= 0 || traineeUserId <= 0) throw new ArgumentException("Both user ids must be positive");
            if (coachUserId == traineeUserId) throw new ArgumentException("Coach and trainee cannot be the same user");
            return _dal.SendCoachOffer(coachUserId, traineeUserId);
        }

        public CoachOffer RespondCoachOffer(int offerId, bool accept)
        {
            if (offerId <= 0) throw new ArgumentException("OfferID must be positive");
            return _dal.RespondCoachOffer(offerId, accept);
        }

        public List<CoachOfferContact> GetCoachOffersForTrainee(int traineeUserId)
        {
            if (traineeUserId <= 0) throw new ArgumentException("UserID must be positive");
            return _dal.GetCoachOffersForTrainee(traineeUserId);
        }

        public List<CoachOffer> GetSentCoachOffers(int coachUserId)
        {
            if (coachUserId <= 0) throw new ArgumentException("UserID must be positive");
            return _dal.GetSentCoachOffers(coachUserId);
        }
    }
}
