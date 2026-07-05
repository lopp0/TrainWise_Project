namespace TrainWise.BL.Models
{
    // #140 — an emoji reaction on a chat message (one per user per message).
    public class MessageReaction
    {
        public int MessageID { get; set; }
        public int UserID { get; set; }
        public string? Emoji { get; set; }
    }
}
