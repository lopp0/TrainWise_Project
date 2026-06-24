namespace TrainWise.BL.Models
{
    public class CreateInjuryReportRequest
    {
        public int UserID { get; set; }
        public int InjuryTypeID { get; set; }
        public DateTime Date { get; set; }
        public int Severity { get; set; }
        public string Notes { get; set; }
        // B-7: optional workout this injury is attributed to (ActivityLogs.ActivityID).
        public int? LinkedActivityLogID { get; set; }
    }
}
