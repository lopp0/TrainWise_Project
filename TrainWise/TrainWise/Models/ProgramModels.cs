namespace TrainWise.BL.Models
{
    // #133 — Assigned training programs. A coach builds a reusable multi-week
    // program (template rows) and assigns it to a trainee; assigning fans the
    // rows out into the trainee's PlannedWorkouts (calendar).

    public class TrainingProgram
    {
        public int ProgramID { get; set; }
        public int CoachUserID { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public int DurationWeeks { get; set; }
        public DateTime CreatedAt { get; set; }
        public int WorkoutCount { get; set; }                       // list view convenience
        public List<ProgramWorkout> Workouts { get; set; } = new();
    }

    public class ProgramWorkout
    {
        public int ProgramWorkoutID { get; set; }
        public int ProgramID { get; set; }
        public int WeekNumber { get; set; }   // 1-based
        public int DayOfWeek { get; set; }    // 0=Mon .. 6=Sun
        public int? ActivityTypeID { get; set; }
        public int? Duration { get; set; }    // minutes
        public double? Distance { get; set; } // km
        public double? Load { get; set; }     // target session load
        public string Notes { get; set; }
    }

    public class ProgramAssignment
    {
        public int AssignmentID { get; set; }
        public int ProgramID { get; set; }
        public int TraineeUserID { get; set; }
        public int CoachUserID { get; set; }
        public DateTime StartDate { get; set; }
        public string Status { get; set; }
        public DateTime AssignedAt { get; set; }
        // projected joins for the list screens
        public string ProgramName { get; set; }
        public string CoachName { get; set; }
        public string TraineeName { get; set; }
        public int DurationWeeks { get; set; }
        public int WorkoutCount { get; set; }
    }

    // Per-assignment chat message (mirrors EventMessage exactly so the client
    // reuses the group-chat UI).
    public class ProgramMessage
    {
        public int MessageId { get; set; }
        public int AssignmentId { get; set; }
        public int SenderId { get; set; }
        public string SenderName { get; set; }
        public string SenderImage { get; set; }
        public string Text { get; set; }
        public string ImagePath { get; set; }
        public string VideoPath { get; set; }
        public string AudioPath { get; set; }
        public int SeenCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ProgramMessageReaction
    {
        public int MessageId { get; set; }
        public int UserId { get; set; }
        public string Emoji { get; set; }
    }

    // ── request DTOs (optional fields are string?/nullable — nullable refs are
    //    ON, so a plain string would be implicitly [Required] and 400) ──────────
    public class CreateProgramRequest
    {
        public string Name { get; set; }
        public string? Description { get; set; }
        public int DurationWeeks { get; set; }
        public List<ProgramWorkoutRequest> Workouts { get; set; } = new();
    }

    public class ProgramWorkoutRequest
    {
        public int WeekNumber { get; set; }
        public int DayOfWeek { get; set; }
        public int? ActivityTypeId { get; set; }
        public int? Duration { get; set; }
        public double? Distance { get; set; }
        public double? Load { get; set; }
        public string? Notes { get; set; }
    }

    public class AssignProgramRequest
    {
        public int TraineeUserId { get; set; }
        public string StartDate { get; set; }   // YYYY-MM-DD
    }

    public class PostProgramMessageRequest
    {
        public int SenderId { get; set; }
        public string? Text { get; set; }
        public string? ImagePath { get; set; }
        public string? VideoPath { get; set; }
        public string? AudioPath { get; set; }
    }

    public class ReactProgramMessageRequest
    {
        public int UserId { get; set; }
        public string Emoji { get; set; }
    }
}
