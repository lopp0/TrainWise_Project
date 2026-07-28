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

        // #146 — seeded gyms MERGED with live Google Places results (server-side
        // key, cached). Places gyms are deduped against seeded ones by name or
        // proximity so the same gym doesn't appear twice. Sorted by distance.
        public List<Gym> GetNearbyMerged(double lat, double lng, double radiusKm)
        {
            var seeded = GetGyms(lat, lng, radiusKm);
            var places = PlacesService.GetNearbyGyms(lat, lng, radiusKm);
            if (places.Count == 0) return seeded;

            string Norm(string s) => new string((s ?? "").ToLowerInvariant()
                .Where(char.IsLetterOrDigit).ToArray());

            var merged = new List<Gym>(seeded);
            foreach (var p in places)
            {
                bool dupe = seeded.Any(g =>
                    Norm(g.Name) == Norm(p.Name) ||
                    HaversineKm(g.Latitude, g.Longitude, p.Latitude, p.Longitude) < 0.12); // ~120m
                if (!dupe) merged.Add(p);
            }
            return merged.OrderBy(g => g.DistanceKm).ToList();
        }

        private static double HaversineKm(double lat1, double lng1, double lat2, double lng2)
        {
            double R = 6371.0;
            double dLat = (lat2 - lat1) * Math.PI / 180.0;
            double dLng = (lng2 - lng1) * Math.PI / 180.0;
            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                       Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                       Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
            return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
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
