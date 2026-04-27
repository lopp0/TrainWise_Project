namespace TrainWise.BL.Models
{
    public class CreateActivityLogRequest
    {
        public int UserID { get; set; }
        public int ActivityTypeID { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public double DistanceKM { get; set; }
        public int? AvgHeartRate { get; set; }
        public int? MaxHeartRate { get; set; }
        public double? CaloriesBurned { get; set; }
        public string SourceDevice { get; set; }
        public byte ExertionLevel { get; set; }
        public short Duration { get; set; }
        public bool IsConfirmed { get; set; }
    }
}
