using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // Business logic for gyms + gym↔coach recommendations (#3).
    public class GymBL
    {
        private readonly GymDAL _dal = new GymDAL();

        public List<Gym> GetGyms(double lat, double lng, double radiusKm)
        {
            if (lat < -90 || lat > 90) throw new ArgumentException("Latitude out of range");
            if (lng < -180 || lng > 180) throw new ArgumentException("Longitude out of range");
            if (radiusKm <= 0) radiusKm = 25;
            if (radiusKm > 200) radiusKm = 200;
            return _dal.GetGyms(lat, lng, radiusKm);
        }

        public List<GymCoachContact> GetGymCoaches(int gymId)
        {
            if (gymId <= 0) throw new ArgumentException("GymID must be positive");
            return _dal.GetGymCoaches(gymId);
        }

        public void AddCoachToGym(int gymId, int coachUserId)
        {
            if (gymId <= 0) throw new ArgumentException("GymID must be positive");
            if (coachUserId <= 0) throw new ArgumentException("CoachUserID must be positive");
            _dal.AddCoachToGym(gymId, coachUserId);
        }

        public void RemoveCoachFromGym(int gymId, int coachUserId)
        {
            if (gymId <= 0) throw new ArgumentException("GymID must be positive");
            if (coachUserId <= 0) throw new ArgumentException("CoachUserID must be positive");
            _dal.RemoveCoachFromGym(gymId, coachUserId);
        }

        public List<GymRef> GetGymsForCoach(int coachUserId)
        {
            if (coachUserId <= 0) throw new ArgumentException("CoachUserID must be positive");
            return _dal.GetGymsForCoach(coachUserId);
        }
    }
}
