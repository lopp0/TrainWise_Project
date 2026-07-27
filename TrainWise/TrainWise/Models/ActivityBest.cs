namespace TrainWise.BL.Models
{
    // #165 — best efforts per activity type, computed from confirmed ActivityLogs.
    public class ActivityBest
    {
        public int ActivityTypeID { get; set; }
        public string TypeName { get; set; }
        public int Sessions { get; set; }
        public double MaxDistanceKm { get; set; }
        public int MaxDurationMin { get; set; }
        public int MaxLoad { get; set; }
        public double? BestPaceMinPerKm { get; set; }
        public DateTime? LastDone { get; set; }
    }
}
