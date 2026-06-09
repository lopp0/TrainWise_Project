namespace TrainWise.BL.Models
{
    public class CreateCoachRecommendationRequest
    {
        public int CoachID { get; set; }
        public int UserID { get; set; }
        public DateTime Date { get; set; }
        public string Title { get; set; }
        public string Text { get; set; }
    }
}
