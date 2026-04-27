namespace TrainWise.BL.Models
{
    public class DailyLoad
    {
        public int LoadID { get; set; }
        public int UserID { get; set; }
        public DateTime Date { get; set; }
        public double AcuteLoad { get; set; }
        public double ChronicLoad { get; set; }
        public double? AC_Ratio { get; set; }
        public int StressScore { get; set; }
        public string LoadLevel { get; set; }
    }
}
