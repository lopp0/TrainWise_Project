using System.Linq;
using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // A-5 — evaluates personal records + milestone badges from the user's
    // confirmed ActivityLogs. Called via POST /api/records/check/{userId} after
    // every workout (manual submit + HC sync), and read via GET /api/records/{userId}.
    public class RecordsBL
    {
        private readonly RecordsDAL _dal = new RecordsDAL();
        private readonly ActivityLogDAL _logDal = new ActivityLogDAL();
        private readonly InjuryReportDAL _injuryDal = new InjuryReportDAL();

        public RecordsResult Get(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            return new RecordsResult
            {
                Records = _dal.GetRecords(userId),
                Badges = _dal.GetBadges(userId),
            };
        }

        public RecordsResult Check(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");

            var logs = _logDal.GetByUser(userId)
                .Where(l => l.IsConfirmed)
                .OrderBy(l => l.StartTime)
                .ToList();

            var existing = _dal.GetRecords(userId)
                .ToDictionary(r => r.MetricType, r => r.RecordValue, StringComparer.OrdinalIgnoreCase);

            bool improvedExistingPR = false;

            void TrySet(string metric, double value, int? linkedLog)
            {
                if (value <= 0) return;
                bool had = existing.TryGetValue(metric, out var cur);
                if (!had || value > cur)
                {
                    _dal.UpsertRecord(userId, metric, value, DateTime.Now, linkedLog);
                    if (had && value > cur) improvedExistingPR = true;
                }
            }

            if (logs.Count > 0)
            {
                var maxDist = logs.Where(l => l.DistanceKM > 0).OrderByDescending(l => l.DistanceKM).FirstOrDefault();
                if (maxDist != null) TrySet("longest_distance_km", maxDist.DistanceKM, maxDist.ActivityID);

                var maxDur = logs.OrderByDescending(l => l.Duration).First();
                TrySet("longest_duration_min", maxDur.Duration, maxDur.ActivityID);

                var maxLoad = logs.OrderByDescending(l => l.CalculatedLoadForSession).First();
                TrySet("highest_load", maxLoad.CalculatedLoadForSession, maxLoad.ActivityID);

                TrySet("most_weekly_sessions", MostWeeklySessions(logs), null);
                TrySet("longest_streak_days", LongestStreak(logs), null);
            }

            // ── Badges ──
            var newly = new List<string>();
            void Award(string key) { if (_dal.AwardBadge(userId, key)) newly.Add(key); }

            int totalSessions = logs.Count;
            double lifetimeLoad = logs.Sum(l => (double)l.CalculatedLoadForSession);
            int streak = LongestStreak(logs);
            double bestDistance = logs.Where(l => l.DistanceKM > 0).Select(l => l.DistanceKM).DefaultIfEmpty(0).Max();
            int bestDuration = logs.Select(l => l.Duration).DefaultIfEmpty(0).Max();

            if (totalSessions >= 1) Award("first_workout");
            if (streak >= 3) Award("streak_3");
            if (streak >= 7) Award("streak_7");
            if (streak >= 30) Award("streak_30");
            if (bestDistance >= 5) Award("distance_5k");
            if (bestDistance >= 10) Award("distance_10k");
            if (bestDistance >= 21) Award("distance_21k");
            if (bestDistance >= 42) Award("distance_42k");
            if (bestDuration >= 60) Award("duration_60");
            if (bestDuration >= 120) Award("duration_120");
            if (lifetimeLoad >= 1000) Award("load_bronze");
            if (lifetimeLoad >= 5000) Award("load_silver");
            if (lifetimeLoad >= 20000) Award("load_gold");
            if (totalSessions >= 10) Award("sessions_10");
            if (totalSessions >= 50) Award("sessions_50");
            if (totalSessions >= 100) Award("sessions_100");
            if (improvedExistingPR) Award("first_pr");

            var injuries = _injuryDal.GetInjuriesByUser(userId);
            bool injuryInLast30 = injuries.Any(i => i.Date >= DateTime.Today.AddDays(-30));
            if (totalSessions >= 1 && !injuryInLast30) Award("injury_free_30");

            return new RecordsResult
            {
                Records = _dal.GetRecords(userId),
                Badges = _dal.GetBadges(userId),
                NewBadges = newly,
            };
        }

        // Max number of sessions in any Monday-anchored week.
        private static int MostWeeklySessions(List<ActivityLog> logs)
        {
            return logs
                .GroupBy(l =>
                {
                    var d = l.StartTime.Date;
                    int diff = ((int)d.DayOfWeek + 6) % 7; // Monday = 0
                    return d.AddDays(-diff);
                })
                .Select(g => g.Count())
                .DefaultIfEmpty(0)
                .Max();
        }

        // Longest run of consecutive calendar days with >=1 workout.
        private static int LongestStreak(List<ActivityLog> logs)
        {
            var days = logs.Select(l => l.StartTime.Date).Distinct().OrderBy(d => d).ToList();
            if (days.Count == 0) return 0;
            int best = 1, cur = 1;
            for (int i = 1; i < days.Count; i++)
            {
                int gap = (days[i] - days[i - 1]).Days;
                if (gap == 1) { cur++; best = Math.Max(best, cur); }
                else if (gap > 1) { cur = 1; }
            }
            return best;
        }
    }
}
