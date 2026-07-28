using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Tests
{
    /// <summary>
    /// Hand-computed vectors from the 2026-07-06 load-math correctness review.
    /// They pin the shared window statics in LoadCalculationBL — the single
    /// source of truth that ml/features.py and the JS mirrors (utils/acwr.js,
    /// utils/loadSeries.js, WarningsDashboardScreen) must match.
    /// </summary>
    public class LoadMathTests
    {
        private static readonly DateTime D = new(2026, 7, 6); // any fixed "today"
        private static readonly LoadParameters P = new();

        private static ActivityLog Log(DateTime startUtc, int load, bool confirmed = true) => new()
        {
            StartTime = startUtc,
            CalculatedLoadForSession = load,
            IsConfirmed = confirmed,
        };

        private static Dictionary<DateTime, double> Days(params (int daysAgo, double load)[] entries)
        {
            var map = new Dictionary<DateTime, double>();
            foreach (var (ago, load) in entries)
                map[D.AddDays(-ago)] = map.GetValueOrDefault(D.AddDays(-ago)) + load;
            return map;
        }

        // ---- V1: brand-new beginner, one 300-load workout today ------------
        // Cold-start floor (150) applies → ratio 2.0 → Red. The oversized
        // first session must still warn.
        [Fact]
        public void V1_NewUser_FirstBigWorkout_IsRed()
        {
            var loadByDay = Days((0, 300));
            double acute = LoadCalculationBL.SumRange(loadByDay, D.AddDays(-6), D);
            double chronic = LoadCalculationBL.EffectiveChronic(loadByDay, D, 150);

            Assert.Equal(300, acute);
            Assert.Equal(150, chronic);
            Assert.Equal("Red", LoadCalculationBL.DetermineLoadLevel(acute / chronic, false, P));
        }

        // ---- V2: same workout but an unconfirmed HC import ------------------
        // Pending imports are not real workouts yet — they must not move the
        // load. (Bug B1: the SP has no IsConfirmed filter; BucketByLocalDay
        // now applies the app's skip rule.)
        [Fact]
        public void V2_UnconfirmedImport_DoesNotCount()
        {
            var sessions = new List<ActivityLog> { Log(D.AddHours(10), 300, confirmed: false) };
            var loadByDay = LoadCalculationBL.BucketByLocalDay(sessions, 0);

            Assert.Empty(loadByDay);
        }

        // ---- V3: steady 100/day user, day 14 --------------------------------
        // The covered-days ramp divides by the weeks actually covered (2), so
        // steady training reads 1.0 (Yellow), not the old false Red 2.0.
        [Fact]
        public void V3_SteadyTwoWeekUser_IsNotFalseRed()
        {
            var entries = new (int, double)[14];
            for (int i = 0; i < 14; i++) entries[i] = (i, 100);
            var loadByDay = Days(entries);

            double acute = LoadCalculationBL.SumRange(loadByDay, D.AddDays(-6), D);
            double chronic = LoadCalculationBL.EffectiveChronic(loadByDay, D, 150);

            Assert.Equal(700, acute);
            Assert.Equal(700, chronic); // 1400 / min(4, 14/7) = 1400 / 2
            Assert.Equal("Yellow", LoadCalculationBL.DetermineLoadLevel(acute / chronic, false, P));
        }

        // Day 7 of the same steady user: covered 7 → divisor 1 → ratio 1.0.
        // (The old fixed /4 read 4.0 the moment the floor lifted.)
        [Fact]
        public void V3b_SteadyUser_Day7_RatioIsOne()
        {
            var entries = new (int, double)[7];
            for (int i = 0; i < 7; i++) entries[i] = (i, 100);
            var loadByDay = Days(entries);

            double chronic = LoadCalculationBL.EffectiveChronic(loadByDay, D, 150);
            Assert.Equal(700, chronic);
        }

        // Full 28-day history: covered 28 → divisor 4, exactly the old math.
        [Fact]
        public void V3c_FullHistory_Unchanged()
        {
            var entries = new (int, double)[28];
            for (int i = 0; i < 28; i++) entries[i] = (i, 100);
            var loadByDay = Days(entries);

            double chronic = LoadCalculationBL.EffectiveChronic(loadByDay, D, 150);
            Assert.Equal(700, chronic); // 2800 / 4
        }

        // ---- V4: advanced athlete returns from a 25-day layoff --------------
        // Only 3 active days in the window → the DYNAMIC floor re-arms (the old
        // one-shot Users.IsBaselineEstablished flag never reset, storing a
        // false Red 2.4 while the app screens showed Green).
        [Fact]
        public void V4_ReturningAthlete_FloorReArms_Green()
        {
            var loadByDay = Days((27, 100), (26, 100), (0, 300));

            double acute = LoadCalculationBL.SumRange(loadByDay, D.AddDays(-6), D);
            double chronic = LoadCalculationBL.EffectiveChronic(loadByDay, D, 420);

            Assert.Equal(300, acute);
            Assert.Equal(420, chronic); // max(500/4, 420)
            Assert.Equal("Green", LoadCalculationBL.DetermineLoadLevel(acute / chronic, false, P));
        }

        // ---- V5: timezone bucketing -----------------------------------------
        // A workout at 00:30 Israel time (21:30 UTC the previous day) must
        // count on the LOCAL day. tz 0 keeps the legacy UTC-day behavior.
        [Fact]
        public void V5_TzOffset_BucketsToLocalDay()
        {
            var fridayNightUtc = new DateTime(2026, 7, 3, 21, 30, 0);
            var sessions = new List<ActivityLog> { Log(fridayNightUtc, 200) };

            var utcBuckets = LoadCalculationBL.BucketByLocalDay(sessions, 0);
            var israelBuckets = LoadCalculationBL.BucketByLocalDay(sessions, 180);

            Assert.Equal(200, utcBuckets[new DateTime(2026, 7, 3)]);
            Assert.Equal(200, israelBuckets[new DateTime(2026, 7, 4)]);
        }

        // A session at exactly next-day midnight belongs to the next day (the
        // SP's inclusive <= end bound used to leak it into the prior window).
        [Fact]
        public void V5b_MidnightSession_BucketsToItsOwnDay()
        {
            var sessions = new List<ActivityLog> { Log(D.AddDays(1), 100) };
            var buckets = LoadCalculationBL.BucketByLocalDay(sessions, 0);

            double acute = LoadCalculationBL.SumRange(buckets, D.AddDays(-6), D);
            Assert.Equal(0, acute);
        }

        // ---- V6: level bands -------------------------------------------------
        // Healthy: Green < 0.8, Yellow 0.8..1.3, Red > 1.3.
        // Injured: Red >= 1.2 and Yellow runs to the Red line — the old 1.1
        // Yellow cap left a gap where an injured 1.15 read GREEN.
        [Theory]
        [InlineData(0.79, false, "Green")]
        [InlineData(0.8, false, "Yellow")]
        [InlineData(1.3, false, "Yellow")]
        [InlineData(1.31, false, "Red")]
        [InlineData(1.15, true, "Yellow")] // the B3 gap fix
        [InlineData(1.19, true, "Yellow")]
        [InlineData(1.2, true, "Red")]
        [InlineData(0.79, true, "Green")]
        public void V6_LevelBands(double ratio, bool injured, string expected)
        {
            Assert.Equal(expected, LoadCalculationBL.DetermineLoadLevel(ratio, injured, P));
        }

        [Fact]
        public void V6b_NullRatio_IsGreen()
        {
            Assert.Equal("Green", LoadCalculationBL.DetermineLoadLevel(null, false, P));
            Assert.Equal("Green", LoadCalculationBL.DetermineLoadLevel(null, true, P));
        }

        // Two sessions on one day sum; a NULL-IsConfirmed legacy row counts
        // (the DAL maps NULL → true).
        [Fact]
        public void Bucketing_SumsSameDaySessions()
        {
            var sessions = new List<ActivityLog>
            {
                Log(D.AddHours(8), 100),
                Log(D.AddHours(18), 150),
            };
            var buckets = LoadCalculationBL.BucketByLocalDay(sessions, 0);
            Assert.Equal(250, buckets[D]);
        }
    }
}
