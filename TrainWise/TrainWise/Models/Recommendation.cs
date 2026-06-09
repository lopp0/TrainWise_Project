namespace TrainWise.BL.Models
{
    public class Recommendation
    {
        public int RecID { get; set; }
        public int UserID { get; set; }
        public DateTime Date { get; set; }
        public string LoadLevel { get; set; }
        public string RecommendationText { get; set; }
        public string Type { get; set; }
    }
}
