using System.Collections.Concurrent;
using System.Text.Json;
using TrainWise.BL.Models;

namespace TrainWise.BL
{
    /// <summary>
    /// #146 — server-side proxy for Google Places "nearby gyms".
    ///
    /// The Places API is a BILLABLE SKU, so the key lives ONLY in a server env var
    /// (GOOGLE_PLACES_KEY) — never in the shipped app — and results are cached
    /// aggressively to cap cost. When the key is unset the service returns an empty
    /// list and the caller falls back to the seeded gyms (graceful degradation).
    /// </summary>
    public static class PlacesService
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };

        // Cache keyed by rounded location+radius; TTL keeps the Places call rare.
        private static readonly ConcurrentDictionary<string, (DateTime at, List<Gym> gyms)> Cache = new();
        private static readonly TimeSpan Ttl = TimeSpan.FromHours(6);

        private static string? Key =>
            Environment.GetEnvironmentVariable("GOOGLE_PLACES_KEY");

        public static bool Enabled => !string.IsNullOrWhiteSpace(Key);

        // Last Places API status ("OK", "REQUEST_DENIED", "ZERO_RESULTS", ...) +
        // any error message, exposed for the /gyms/places-debug endpoint so setup
        // issues (API not enabled / key restricted) are diagnosable.
        public static string LastStatus { get; private set; } = "not-called";
        public static string LastError { get; private set; } = "";

        public static List<Gym> GetNearbyGyms(double lat, double lng, double radiusKm)
        {
            if (!Enabled) { LastStatus = "no-key"; return new List<Gym>(); }

            double radiusM = Math.Min(50000, Math.Max(500, radiusKm * 1000)); // Places max 50km
            string cacheKey = $"{Math.Round(lat, 2)},{Math.Round(lng, 2)},{Math.Round(radiusM)}";
            if (Cache.TryGetValue(cacheKey, out var hit) && DateTime.UtcNow - hit.at < Ttl)
                return hit.gyms;

            var gyms = new List<Gym>();
            try
            {
                string url =
                    "https://maps.googleapis.com/maps/api/place/nearbysearch/json" +
                    $"?location={lat},{lng}&radius={radiusM}&type=gym&key={Key}";
                string json = Http.GetStringAsync(url).GetAwaiter().GetResult();
                using var doc = JsonDocument.Parse(json);
                LastStatus = doc.RootElement.TryGetProperty("status", out var st) ? (st.GetString() ?? "?") : "?";
                LastError = doc.RootElement.TryGetProperty("error_message", out var em) ? (em.GetString() ?? "") : "";
                if (!doc.RootElement.TryGetProperty("results", out var results)) return gyms;

                int synthetic = -1; // negative ids: transient (not DB-backed) so the client can tell
                foreach (var r in results.EnumerateArray())
                {
                    if (!r.TryGetProperty("geometry", out var geo) ||
                        !geo.TryGetProperty("location", out var loc)) continue;
                    double glat = loc.GetProperty("lat").GetDouble();
                    double glng = loc.GetProperty("lng").GetDouble();
                    string name = r.TryGetProperty("name", out var n) ? (n.GetString() ?? "Gym") : "Gym";
                    string address = r.TryGetProperty("vicinity", out var v) ? (v.GetString() ?? "") : "";
                    decimal? rating = r.TryGetProperty("rating", out var rt) && rt.ValueKind == JsonValueKind.Number
                        ? (decimal?)rt.GetDecimal() : null;

                    gyms.Add(new Gym
                    {
                        GymID = synthetic--,
                        Name = name,
                        Address = address,
                        City = "",
                        Latitude = glat,
                        Longitude = glng,
                        Description = "From Google Places",
                        Rating = rating,
                        Phone = "",
                        PhotoPath = "",
                        DistanceKm = HaversineKm(lat, lng, glat, glng),
                        CoachCount = 0
                    });
                }
            }
            catch (Exception ex)
            {
                LastStatus = "exception";
                LastError = ex.Message;
                return new List<Gym>(); // Places offline / quota — degrade silently
            }

            Cache[cacheKey] = (DateTime.UtcNow, gyms);
            return gyms;
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
    }
}
