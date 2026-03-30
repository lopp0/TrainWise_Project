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
    }
}
