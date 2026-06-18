namespace TrainWise.BL.Models
{
    public class TraineeSummary
    {
        public int UserID { get; set; }
        public string FullName { get; set; }
        public int BirthYear { get; set; }
        public string Gender { get; set; }
        public string DeviceType { get; set; }

        public DateTime? LastDate { get; set; }
        public double? AcuteLoad { get; set; }
        public double? ChronicLoad { get; set; }
        public double? AC_Ratio { get; set; }
        public string LoadLevel { get; set; }
    }
}
