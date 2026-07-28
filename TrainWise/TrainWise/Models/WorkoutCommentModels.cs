namespace TrainWise.BL.Models
{
    // #134 — a coach's (or the owner's) comment on a specific workout log.
    public class WorkoutComment
    {
        public int CommentId { get; set; }
        public int ActivityID { get; set; }
        public int AuthorUserID { get; set; }
        public string AuthorName { get; set; }
        public string AuthorImage { get; set; }
        public bool IsCoach { get; set; }
        public string Text { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class AddWorkoutCommentRequest
    {
        public int AuthorUserID { get; set; }
        public string Text { get; set; }
    }
}
