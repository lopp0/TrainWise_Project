namespace TrainWise.BL.Models
{
    public class Message
    {
        public int MessageID { get; set; }
        public int SenderID { get; set; }
        public int ReceiverID { get; set; }
        public string Text { get; set; }
        public DateTime SentAt { get; set; }
        public bool IsSeen { get; set; }
        public string ImagePath { get; set; } // nullable — set for image messages
    }
}
