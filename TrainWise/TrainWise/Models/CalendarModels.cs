namespace TrainWise.BL.Models
{
    // A-4 — Training Calendar planned workouts.
    public class PlannedWorkout
    {
        public int PlanId { get; set; }
        public int UserID { get; set; }
        public int? CreatedByCoach { get; set; }   // null = user planned it
        public int? ActivityTypeId { get; set; }
        public DateTime PlannedDate { get; set; }
        public int? PlannedDuration { get; set; }
        public double? PlannedDistance { get; set; }
        public double? PlannedLoad { get; set; }
        public string Notes { get; set; }
        public bool IsCompleted { get; set; }
        public int? LinkedLogId { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class PlannedWorkoutRequest
    {
        public int? CreatedByCoach { get; set; }
        public int? ActivityTypeId { get; set; }
        public string PlannedDate { get; set; }   // YYYY-MM-DD
        public int? PlannedDuration { get; set; }
        public double? PlannedDistance { get; set; }
        public double? PlannedLoad { get; set; }
        public string Notes { get; set; }
    }
}
