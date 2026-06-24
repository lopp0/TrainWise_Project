namespace TrainWise.BL.Models
{
    public class InjuryReport
    {
        public int InjuryID { get; set; }
        public int UserID { get; set; }
        public int InjuryTypeID { get; set; }
        public DateTime Date { get; set; }
        public int Severity { get; set; }
        public string Notes { get; set; }
        public bool IsActiveInjury { get; set; }
        // B-7: optional link to the workout after which the injury appeared.
        public int? LinkedActivityLogID { get; set; }
    }
}
