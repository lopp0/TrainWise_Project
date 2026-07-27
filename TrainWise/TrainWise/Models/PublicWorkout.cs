namespace TrainWise.BL.Models
{
    // #181 — the ONLY fields exposed by the public (anonymous) shared-workout
    // endpoint. Deliberately excludes owner identity, heart rate, calories and
    // any PII — a shared link reveals just the activity summary.
    public class PublicWorkout
    {
        public int ActivityID { get; set; }
        public string ActivityName { get; set; }
        public int Duration { get; set; }
        public double DistanceKM { get; set; }
        public byte ExertionLevel { get; set; }
        public int SessionLoad { get; set; }
        public DateTime StartTime { get; set; }
    }
}
