namespace TrainWise.BL.Models
{
    /// <summary>
    /// Day-by-day training-load analytics for the trend charts (trainee Load tab
    /// and coach detail). Every point carries the AC ratio computed with BOTH
    /// supported methods so the client can switch views without refetching:
    ///   - Rolling  : classic coupled ACWR (Gabbett 2016) — acute = 7-day sum,
    ///                chronic = 28-day sum / 4. This stays the app's official
    ///                method (status card / recommendations / stored DailyLoad).
    ///   - EWMA     : exponentially weighted moving averages (Williams et al.
    ///                2017), lambda = 2/(N+1) with N = 7 (acute) and 28 (chronic).
    ///                Smoother, weighs recent sessions more, no 28-day cliff.
    /// </summary>
    public class LoadAnalytics
    {
        public DateTime From { get; set; }
        public DateTime To { get; set; }

        // ACWR zone thresholds (from LoadParameters; defaults 0.8 / 1.3 / 1.5).
        public double SafeLow { get; set; }
        public double SafeHigh { get; set; }
        public double Overload { get; set; }

        public bool BaselineEstablished { get; set; }
        public bool HasActiveInjury { get; set; }

        public List<LoadSeriesPoint> Series { get; set; } = new();
        public LoadSummary Summary { get; set; } = new();
    }

    public class LoadSeriesPoint
    {
        public DateTime Date { get; set; }

        /// <summary>Sum of confirmed session loads on this calendar day.</summary>
        public double DailyLoad { get; set; }

        // Classic rolling ACWR (weekly-equivalent units on both sides).
        public double RollingAcute { get; set; }
        public double RollingChronic { get; set; }
        public double? RollingRatio { get; set; }
        public string RollingLevel { get; set; } = "Green";

        // EWMA ACWR (daily-scale averages; the ratio is unitless like rolling).
        public double EwmaAcute { get; set; }
        public double EwmaChronic { get; set; }
        public double? EwmaRatio { get; set; }
        public string EwmaLevel { get; set; } = "Green";
    }

    /// <summary>
    /// Headline analytics computed over the trailing windows ending "today"
    /// (the last day of the series).
    /// </summary>
    public class LoadSummary
    {
        /// <summary>
        /// Training monotony (Foster 1998): mean / stdev of the last 7 daily
        /// loads (rest days count as 0). Under ~1.5 = healthy variety; above
        /// ~2.0 = repetitive training, which raises strain for the same volume.
        /// </summary>
        public double Monotony { get; set; }

        /// <summary>Training strain (Foster 1998): weekly load x monotony.</summary>
        public double Strain { get; set; }

        // Duration-weighted intensity mix over the last 28 days, bucketed from
        // session RPE (ExertionLevel): 1-3 low, 4-6 moderate, 7-10 high.
        // Reference distribution for endurance training is ~70/10/20 (Seiler).
        public double LowPct { get; set; }
        public double ModeratePct { get; set; }
        public double HighPct { get; set; }

        /// <summary>Distinct training days in the last 28 days.</summary>
        public int ActiveDays28 { get; set; }

        /// <summary>Full rest days in the last 7 days.</summary>
        public int RestDays7 { get; set; }
    }
}
