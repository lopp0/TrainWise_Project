using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    /// <summary>
    /// Computes the day-by-day training-load series that powers the trend charts
    /// (trainee Load tab + coach detail). Every published formula is cited next
    /// to its implementation — no black boxes:
    ///
    ///   ACWR (rolling, coupled)  Gabbett, BJSM 2016 — "the training-injury
    ///       prevention paradox". Acute = 7-day load sum; chronic = 28-day sum/4.
    ///   ACWR (EWMA)              Williams et al., BJSM 2017; Murray et al. 2017
    ///       showed EWMA is more sensitive to injury-risk spikes than rolling.
    ///       EWMA_today = load * lambda + (1 - lambda) * EWMA_yesterday,
    ///       lambda = 2 / (N + 1)  →  0.25 (N=7 acute), ~0.069 (N=28 chronic).
    ///   Sweet spot 0.8-1.3       Both edges matter: above ~1.5 = spike risk,
    ///       below 0.8 = detraining (the J-shaped risk curve, Gabbett 2016).
    ///   Monotony / Strain        Foster, MSSE 1998 — monotony = mean/stdev of
    ///       the last 7 daily loads; strain = weekly load x monotony.
    ///   Intensity distribution   Seiler 2010 — endurance reference ~70/10/20
    ///       (low/moderate/high), bucketed here from session RPE.
    ///
    /// Reads ONLY confirmed ActivityLogs (recomputed live, like the app screens)
    /// so charts never depend on stale stored DailyLoad rows.
    /// </summary>
    public class LoadAnalyticsBL
    {
        private readonly DailyLoadDAL _loadDal = new DailyLoadDAL();
        private readonly UserDAL _userDal = new UserDAL();

        // EWMA smoothing factors, lambda = 2/(N+1) (standard EMA span formula,
        // the same parameters used in the ACWR literature).
        private const double LambdaAcute = 2.0 / (7 + 1);      // 0.25
        private const double LambdaChronic = 2.0 / (28 + 1);   // ~0.069

        // Days of history computed BEFORE the first displayed day so the EWMA
        // has warmed up and the 28-day rolling window is full. After 56 days,
        // the weight of the zero seed on the chronic EWMA is (1-λc)^56 ≈ 2% —
        // negligible.
        private const int WarmupDays = 56;

        public LoadAnalytics GetAnalytics(int userId, int days, DateTime? end = null)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");
            if (_userDal.GetUserById(userId) == null)
                throw new ArgumentException("User does not exist");

            days = Math.Clamp(days, 14, 112);

            // The client sends ITS calendar date ("end") because Azure App Service
            // runs on UTC — between local midnight and 03:00 Israel time the
            // server's Today is still yesterday and the newest point would be
            // missing. Clamped so a bad client can't ask for far-future windows.
            DateTime to = (end ?? DateTime.Today).Date;
            if (to > DateTime.Today.AddDays(1)) to = DateTime.Today.AddDays(1);
            if (to < DateTime.Today.AddDays(-1)) to = DateTime.Today;
            DateTime from = to.AddDays(-(days - 1));
            DateTime fetchFrom = from.AddDays(-WarmupDays);

            var context = _loadDal.GetUserLoadContext(userId);
            var sessions = _loadDal.GetActivityLogsForRange(userId, fetchFrom, to.AddDays(1));

            // Bucket confirmed session loads per calendar day once, then walk the
            // timeline. Same date semantics as CalculateAndSave (StartTime.Date).
            var loadByDay = new Dictionary<DateTime, double>();
            foreach (var s in sessions)
            {
                var d = s.StartTime.Date;
                loadByDay[d] = loadByDay.GetValueOrDefault(d) + s.CalculatedLoadForSession;
            }

            // Cold-start floors (mirrors CalculateAndSave / the app's acwr util):
            // until the user has >= 7 distinct training days in the trailing 28,
            // judge against the experience-based expected load, not the near-empty
            // history. Rolling chronic is WEEKLY-scale → floor with the weekly
            // bootstrap; EWMA chronic is DAILY-scale → floor with bootstrap / 7.
            double bootstrapWeekly = LoadCalculationBL.GetBootstrapAcuteLoad(
                context.ExperienceLevel, context.Parameters);
            double bootstrapDaily = bootstrapWeekly / 7.0;

            var result = new LoadAnalytics
            {
                From = from,
                To = to,
                SafeLow = context.Parameters.SafeZoneLowRange,
                SafeHigh = context.Parameters.SafeZoneHighRange,
                Overload = context.Parameters.OverLoad,
                BaselineEstablished = context.IsBaselineEstablished,
                HasActiveInjury = context.HasActiveInjury
            };

            double ewmaAcute = 0, ewmaChronic = 0;

            // Bias-corrected EWMA: a zero-seeded EWMA understates the chronic
            // average until enough days have passed, which INFLATES the early
            // ratio — a brand-new user's very first workout would read Red.
            // Dividing by (1 - (1-lambda)^t) removes the zero-initialization
            // bias (same correction Adam uses; Kingma & Ba 2015). t counts from
            // the user's first logged session; the correction converges to 1
            // within weeks, so established users are unaffected.
            DateTime? firstLog = loadByDay.Count > 0 ? loadByDay.Keys.Min() : (DateTime?)null;
            int t = 0;

            for (DateTime d = fetchFrom; d <= to; d = d.AddDays(1))
            {
                double dayLoad = loadByDay.GetValueOrDefault(d);

                // EWMA recurrence (Williams 2017). Rest days feed 0, which decays
                // the averages — that is the point: fitness/fatigue fade smoothly
                // instead of falling off a 7- or 28-day cliff.
                if (firstLog != null && d >= firstLog.Value)
                {
                    t++;
                    ewmaAcute = dayLoad * LambdaAcute + (1 - LambdaAcute) * ewmaAcute;
                    ewmaChronic = dayLoad * LambdaChronic + (1 - LambdaChronic) * ewmaChronic;
                }

                if (d < from) continue; // warmup only — not returned

                double ewmaAcuteCorr = t > 0
                    ? ewmaAcute / (1 - Math.Pow(1 - LambdaAcute, t)) : 0;
                double ewmaChronicCorr = t > 0
                    ? ewmaChronic / (1 - Math.Pow(1 - LambdaChronic, t)) : 0;

                // Rolling windows ending on d (Gabbett 2016, coupled form: the
                // acute week is INCLUDED in the chronic 28 days, like
                // CalculateAndSave and the client's acwr util).
                double acute = SumRange(loadByDay, d.AddDays(-6), d);
                double chronic = SumRange(loadByDay, d.AddDays(-27), d) / 4.0;

                // Per-day baseline check: >= 7 distinct training days inside the
                // trailing 28-day window (same rule the client util applies).
                int activeDays = CountActiveDays(loadByDay, d.AddDays(-27), d);
                bool baselineByDay = activeDays >= 7;

                double effChronic = baselineByDay ? chronic : Math.Max(chronic, bootstrapWeekly);
                double effEwmaChronic = baselineByDay
                    ? ewmaChronicCorr : Math.Max(ewmaChronicCorr, bootstrapDaily);

                double? rollingRatio = effChronic > 0 ? acute / effChronic : (double?)null;
                // No sessions yet (t == 0): no EWMA evidence — the chart shows a
                // gap instead of a misleading flat zero line.
                double? ewmaRatio = t > 0 && effEwmaChronic > 0
                    ? ewmaAcuteCorr / effEwmaChronic : (double?)null;

                result.Series.Add(new LoadSeriesPoint
                {
                    Date = d,
                    DailyLoad = Math.Round(dayLoad),
                    RollingAcute = Math.Round(acute),
                    RollingChronic = Math.Round(effChronic, 1),
                    RollingRatio = rollingRatio == null ? null : Math.Round(rollingRatio.Value, 3),
                    RollingLevel = LoadCalculationBL.DetermineLoadLevel(
                        rollingRatio, context.HasActiveInjury, context.Parameters),
                    EwmaAcute = Math.Round(ewmaAcuteCorr, 1),
                    EwmaChronic = Math.Round(effEwmaChronic, 1),
                    EwmaRatio = ewmaRatio == null ? null : Math.Round(ewmaRatio.Value, 3),
                    EwmaLevel = LoadCalculationBL.DetermineLoadLevel(
                        ewmaRatio, context.HasActiveInjury, context.Parameters)
                });
            }

            result.Summary = BuildSummary(sessions, loadByDay, to);
            return result;
        }

        private static double SumRange(Dictionary<DateTime, double> loadByDay, DateTime start, DateTime end)
        {
            double sum = 0;
            for (DateTime d = start; d <= end; d = d.AddDays(1))
                sum += loadByDay.GetValueOrDefault(d);
            return sum;
        }

        private static int CountActiveDays(Dictionary<DateTime, double> loadByDay, DateTime start, DateTime end)
        {
            int n = 0;
            for (DateTime d = start; d <= end; d = d.AddDays(1))
                if (loadByDay.GetValueOrDefault(d) > 0) n++;
            return n;
        }

        private static LoadSummary BuildSummary(
            List<ActivityLog> sessions, Dictionary<DateTime, double> loadByDay, DateTime today)
        {
            var summary = new LoadSummary();

            // --- Monotony & strain (Foster 1998) over the last 7 days ----------
            // Rest days count as 0 — a week of identical sessions with no rest
            // scores high monotony even at moderate volume, which is the signal.
            var last7 = new double[7];
            for (int i = 0; i < 7; i++)
                last7[i] = loadByDay.GetValueOrDefault(today.AddDays(-i));

            double mean = last7.Average();
            double stdev = Math.Sqrt(last7.Select(v => (v - mean) * (v - mean)).Average());
            double weekly = last7.Sum();

            // stdev 0 with training present = perfectly repetitive → cap at 5.
            double monotony = stdev > 0 ? mean / stdev : (mean > 0 ? 5.0 : 0.0);
            summary.Monotony = Math.Round(Math.Min(monotony, 5.0), 2);
            summary.Strain = Math.Round(weekly * summary.Monotony);
            summary.RestDays7 = last7.Count(v => v <= 0);

            // --- Intensity distribution over the last 28 days -------------------
            // Duration-weighted so a 90-min easy ride counts for more low-zone
            // time than a 10-min sprint counts high-zone. RPE buckets: 1-3 low,
            // 4-6 moderate, 7-10 high (session-RPE zones; Seiler reference).
            DateTime cutoff = today.AddDays(-27);
            double lowMin = 0, modMin = 0, highMin = 0;
            foreach (var s in sessions)
            {
                if (s.StartTime.Date < cutoff || s.StartTime.Date > today) continue;
                double minutes = Math.Max(s.Duration, 0);
                if (s.ExertionLevel <= 3) lowMin += minutes;
                else if (s.ExertionLevel <= 6) modMin += minutes;
                else highMin += minutes;
            }
            double total = lowMin + modMin + highMin;
            if (total > 0)
            {
                summary.LowPct = Math.Round(lowMin / total * 100, 1);
                summary.ModeratePct = Math.Round(modMin / total * 100, 1);
                summary.HighPct = Math.Round(highMin / total * 100, 1);
            }

            summary.ActiveDays28 = CountActiveDays(loadByDay, cutoff, today);
            return summary;
        }
    }
}
