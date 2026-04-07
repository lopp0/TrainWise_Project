namespace TrainWise.BL.Models
{
    public class CoachTrainee
    {
        public int CoachID { get; set; }
        public int UserID { get; set; }
        public DateTime ConnectionDate { get; set; }    
        public bool AllowNotifications { get; set; }
    }
}
