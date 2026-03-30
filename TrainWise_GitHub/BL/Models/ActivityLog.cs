namespace TrainWise.BL.Models
{
    public class ActivityLog
    {
        public int ActivityID { get; set; }
        public int UserID { get; set; }
        public int ActivityTypeID { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public double DistanceKM { get; set; }
        public int AvgHeartRate { get; set; }
        public int MaxHeartRate { get; set; }
        public double CaloriesBurned { get; set; }
        public string SourceDevice { get; set; }
    }
}
