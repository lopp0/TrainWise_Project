namespace TrainWise.BL.Models
{
    public class SendMessageRequest
    {
        public int SenderID { get; set; }
        public int ReceiverID { get; set; }
        // Nullable so [ApiController] validation doesn't treat them as required
        // (nullable reference types are on — a plain `string` is implicitly
        // [Required], which 400'd text messages that send imagePath: null).
        public string? Text { get; set; }
        public string? ImagePath { get; set; } // relative path from /messages/upload
        public string? AudioPath { get; set; } // #139 — from /messages/upload/audio
        public string? VideoPath { get; set; } // #135 — from /messages/upload/video
    }
}
