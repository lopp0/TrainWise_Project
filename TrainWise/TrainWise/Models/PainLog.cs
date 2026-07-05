namespace TrainWise.BL.Models
{
    // #127 — a single daily pain-level (1-10) entry during injury recovery.
    public class PainLog
    {
        public int PainLogID { get; set; }
        public int InjuryID { get; set; }
        public DateTime LoggedAt { get; set; }
        public int Level { get; set; }
        public string? Note { get; set; }
    }
}
