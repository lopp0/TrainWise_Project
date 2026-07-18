namespace TrainWise.BL.Models
{
    public class UserSummary
    {
        public int UserID { get; set; }
        public string FullName { get; set; }
        public string DeviceType { get; set; }
        public string LoadLevel { get; set; }
        public int StressScore { get; set; }
        public DateTime? LastLoadDate { get; set; }
    }
}
