namespace TrainWise.BL.Models
{
    public class CreateInjuryReportRequest
    {
        public int UserID { get; set; }
        public int InjuryTypeID { get; set; }
        public DateTime Date { get; set; }
        public int Severity { get; set; }
        public string Notes { get; set; }
    }
}
