namespace TrainWise.BL.Models
{
    // #119 — a reusable workout template/favorite the user can start from.
    public class WorkoutTemplate
    {
        public int TemplateID { get; set; }
        public int UserID { get; set; }
        public string Name { get; set; }
        public int ActivityTypeID { get; set; }
        public int Duration { get; set; }         // minutes
        public byte ExertionLevel { get; set; }   // 1..10
        public double? TargetValue { get; set; }  // optional distance/reps target
        public DateTime CreatedAt { get; set; }
    }
}
