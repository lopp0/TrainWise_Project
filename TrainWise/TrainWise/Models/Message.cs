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
        public string AudioPath { get; set; } // nullable — set for voice messages (#139)
        public string VideoPath { get; set; } // nullable — set for form-check videos (#135)
    }
}
