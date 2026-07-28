using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class LoadCalculationBL
    {
        private readonly DailyLoadDAL _loadDal = new DailyLoadDAL();
        private readonly UserDAL _userDal = new UserDAL();

        public DailyLoad CalculateAndSave(int userId, DateTime date, int tzOffsetMinutes = 0)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            if (date.Date > DateTime.Today)
                throw new ArgumentException("Date cannot be in the future");

            if (_userDal.GetUserById(userId) == null)
                throw new ArgumentException("User does not exist");

            // Step 1 — fetch last 28 days of session loads from SQL
            var sessions = _loadDal.GetActivityLogsForLoad(userId, date);

            // Step 2 — fetch user context: baseline values, thresholds, HasActiveInjury
            var context = _loadDal.GetUserLoadContext(userId);

            // Step 3 — bucket per calendar day (unconfirmed HC imports excluded,
            // times shifted to the caller's timezone) and compute AcuteLoad
            // (last 7 days, sum) and effective ChronicLoad (28-day weekly
            // average with cold-start floor + partial-history ramp — see
            // EffectiveChronic). The ACWR thresholds in LoadParameters assume
            // weekly-equivalent units on both sides.
            var loadByDay = BucketByLocalDay(sessions, tzOffsetMinutes);

            double acuteLoad = SumRange(loadByDay, date.Date.AddDays(-6), date.Date);
            double bootstrap = GetBootstrapAcuteLoad(context.ExperienceLevel, context.Parameters);
            double chronicLoad = EffectiveChronic(loadByDay, date.Date, bootstrap);

            // Step 4 — compute AC Ratio
            double? acRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : (double?)null;

            // Step 5 — compute StressScore (0-100 scale)
            int stressScore = ComputeStressScore(acuteLoad, context);

            // Step 6 — determine LoadLevel using thresholds, tighter if active injury exists
            string loadLevel = DetermineLoadLevel(acRatio, context.HasActiveInjury, context.Parameters);

            // Step 7 — build the DailyLoad object
            var dailyLoad = new DailyLoad
            {
                UserID = userId,
                Date = date.Date,
                AcuteLoad = acuteLoad,
                ChronicLoad = chronicLoad,
                AC_Ratio = acRatio,
                StressScore = stressScore,
                LoadLevel = loadLevel
            };

            // Step 8 — save to DB via sp_SaveDailyLoad
            dailyLoad.LoadID = _loadDal.SaveDailyLoad(dailyLoad);

            // Step 9 — check if baseline should be established
            if (!context.IsBaselineEstablished &&
                CountActiveDays(loadByDay, date.Date.AddDays(-27), date.Date) >= 7)
            {
                short newDailyBaseline = (short)Math.Round(acuteLoad / 7);
                short newWeeklyBaseline = (short)Math.Round(acuteLoad);
                _userDal.UpdateUserBaseline(userId, newDailyBaseline, newWeeklyBaseline);
            }

            return dailyLoad;
        }

        public List<DailyLoad> GetByUser(int userId)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            return _loadDal.GetDailyLoadByUser(userId);
        }

        private int ComputeStressScore(double acuteLoad, UserLoadContext context)
        {
            double baseline = context.IsBaselineEstablished
                ? context.BaseLineDailyLoad * 7  
                : GetBootstrapAcuteLoad(context.ExperienceLevel, context.Parameters);

            if (baseline <= 0) return 0;

            double ratio = acuteLoad / baseline;
            int score = (int)Math.Round(ratio * 50);
            return Math.Clamp(score, 0, 100);
        }

        // Internal static so LoadAnalyticsBL (trend series) grades every point with
        // the EXACT same thresholds — one source of truth, no drift between the
        // stored DailyLoad and the charts.
        internal static string DetermineLoadLevel(double? acRatio, bool hasActiveInjury, LoadParameters p)
        {
            //   Green  : ratio < 0.8
            //   Yellow : 0.8 <= ratio <= 1.3
            //   Red    : ratio > 1.3
            // Injured users use tighter bands per the same doc.

            if (acRatio == null) return "Green";

            double ratio = acRatio.Value;

            if (hasActiveInjury)
            {
                // Yellow runs up to (not including) the tighter 1.2 Red line —
                // a gap here would make injured users read GREEN at e.g. 1.15
                // where a healthy user reads Yellow (fixed 2026-07-06).
                if (ratio >= 1.2) return "Red";
                if (ratio >= 0.8) return "Yellow";
                return "Green";
            }

            if (ratio > 1.3) return "Red";
            if (ratio >= 0.8) return "Yellow";
            return "Green";
        }

        internal static double GetBootstrapAcuteLoad(byte experienceLevel, LoadParameters p)
        {
            return experienceLevel switch
            {
                1 => p.BeginnerAcuteLoad,
                2 => p.RegularAcuteLoad,
                3 => p.AdvanceAcuteLoad,

                _ => p.BeginnerAcuteLoad
            };
        }

        // ---- Shared window math (used by LoadAnalyticsBL + unit tests) ------
        // These statics are the single source of truth for the load windows;
        // ml/features.py and the JS mirrors (utils/acwr.js, utils/loadSeries.js,
        // WarningsDashboardScreen) must stay in lockstep with them.

        // Buckets confirmed session loads per calendar day in the CALLER'S
        // timezone. StartTime is stored as a UTC instant; without the shift a
        // 00:30 Israel workout lands on the previous UTC day. Bucketing also
        // makes the window sums immune to the SP's inclusive end boundary
        // (a session at exactly next-day midnight buckets to the next day).
        internal static Dictionary<DateTime, double> BucketByLocalDay(
            IEnumerable<ActivityLog> sessions, int tzOffsetMinutes)
        {
            tzOffsetMinutes = Math.Clamp(tzOffsetMinutes, -14 * 60, 14 * 60);
            var loadByDay = new Dictionary<DateTime, double>();
            foreach (var s in sessions)
            {
                if (!s.IsConfirmed) continue; // pending HC imports aren't real yet
                var d = s.StartTime.AddMinutes(tzOffsetMinutes).Date;
                loadByDay[d] = loadByDay.GetValueOrDefault(d) + s.CalculatedLoadForSession;
            }
            return loadByDay;
        }

        internal static double SumRange(
            Dictionary<DateTime, double> loadByDay, DateTime start, DateTime end)
        {
            double sum = 0;
            for (DateTime d = start; d <= end; d = d.AddDays(1))
                sum += loadByDay.GetValueOrDefault(d);
            return sum;
        }

        internal static int CountActiveDays(
            Dictionary<DateTime, double> loadByDay, DateTime start, DateTime end)
        {
            int n = 0;
            for (DateTime d = start; d <= end; d = d.AddDays(1))
                if (loadByDay.GetValueOrDefault(d) > 0) n++;
            return n;
        }

        // Effective chronic load (weekly-equivalent) for the 28-day window
        // ending on `day`, in two regimes:
        //
        //   < 7 active days (cold start / long layoff): judge against the
        //     experience-based expected weekly load — max(sum/4, bootstrap).
        //     A brand-new user's oversized first session still reads Red, and
        //     a returning athlete's easy comeback session isn't a false Red.
        //
        //   >= 7 active days: RAMP the divisor to the days actually covered:
        //     chronic = sum / min(4, covered/7), covered = days from the first
        //     loaded day in the window through `day`. The fixed /4 assumed a
        //     full 28-day history and flagged a perfectly steady 2-week-old
        //     user at ratio 2.0 (false Red); the ramp makes steady training
        //     read ~1.0 from day 7 onward. Full 28-day histories are unchanged
        //     (covered = 28 → divisor 4).
        internal static double EffectiveChronic(
            Dictionary<DateTime, double> loadByDay, DateTime day, double bootstrapWeekly)
        {
            DateTime windowStart = day.AddDays(-27);
            double sum28 = SumRange(loadByDay, windowStart, day);

            if (CountActiveDays(loadByDay, windowStart, day) < 7)
                return Math.Max(sum28 / 4.0, bootstrapWeekly);

            DateTime firstActive = windowStart;
            for (DateTime d = windowStart; d <= day; d = d.AddDays(1))
            {
                if (loadByDay.GetValueOrDefault(d) > 0) { firstActive = d; break; }
            }
            double covered = (day - firstActive).TotalDays + 1; // 7..28
            return sum28 / Math.Min(4.0, covered / 7.0);
        }
    }
}
