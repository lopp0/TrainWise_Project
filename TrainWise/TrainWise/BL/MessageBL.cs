using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class MessageBL
    {
        private readonly MessageDAL _dal = new MessageDAL();
        private readonly UserDAL _userDal = new UserDAL();

        private const int MaxTextLength = 1000;

        public Message Send(Message m)
        {
            if (m.SenderID <= 0) throw new ArgumentException("SenderID is required");
            if (m.ReceiverID <= 0) throw new ArgumentException("ReceiverID is required");
            if (m.SenderID == m.ReceiverID) throw new ArgumentException("Cannot message yourself");

            bool hasText = !string.IsNullOrWhiteSpace(m.Text);
            bool hasImage = !string.IsNullOrWhiteSpace(m.ImagePath);
            bool hasAudio = !string.IsNullOrWhiteSpace(m.AudioPath);   // #139
            bool hasVideo = !string.IsNullOrWhiteSpace(m.VideoPath);   // #135
            if (!hasText && !hasImage && !hasAudio && !hasVideo)
                throw new ArgumentException("Message text or media is required");

            var sender = _userDal.GetUserById(m.SenderID);
            if (sender == null)
                throw new ArgumentException("Sender does not exist");
            if (_userDal.GetUserById(m.ReceiverID) == null)
                throw new ArgumentException("Receiver does not exist");

            // Image-only messages send an empty text (column is NOT NULL).
            m.Text = hasText ? m.Text.Trim() : "";
            if (m.Text.Length > MaxTextLength)
                m.Text = m.Text.Substring(0, MaxTextLength);

            var saved = _dal.Insert(m);

            // Item 12 — remote push to the receiver so they're notified even when
            // the app is closed (best-effort; no-op if they have no push token).
            string preview = hasText
                ? (m.Text.Length > 80 ? m.Text.Substring(0, 80) + "…" : m.Text)
                : hasAudio ? "Sent you a voice message 🎤"
                : hasVideo ? "Sent you a video 🎥"
                : "Sent you a photo 📷";
            PushSender.Send(_userDal.GetPushToken(m.ReceiverID),
                $"{sender.FullName} 💬", preview);

            return saved;
        }

        public List<Message> GetConversation(int userA, int userB)
        {
            if (userA <= 0 || userB <= 0)
                throw new ArgumentException("Both user ids must be positive");
            return _dal.GetConversation(userA, userB);
        }

        public int MarkSeen(int senderId, int receiverId)
        {
            if (senderId <= 0 || receiverId <= 0)
                throw new ArgumentException("Both user ids must be positive");
            return _dal.MarkSeen(senderId, receiverId);
        }

        public int GetUnreadCount(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            return _dal.GetUnreadCount(userId);
        }

        // #138 — typing indicator.
        public void SetTyping(int fromUserId, int toUserId, bool isTyping)
        {
            if (fromUserId <= 0 || toUserId <= 0) throw new ArgumentException("Invalid ids");
            _dal.SetTyping(fromUserId, toUserId, isTyping);
        }

        public bool IsTyping(int fromUserId, int toUserId)
        {
            if (fromUserId <= 0 || toUserId <= 0) throw new ArgumentException("Invalid ids");
            return _dal.IsTyping(fromUserId, toUserId);
        }

        // #140 — message reactions.
        public void React(int messageId, int userId, string emoji)
        {
            if (messageId <= 0 || userId <= 0) throw new ArgumentException("Invalid ids");
            if (string.IsNullOrWhiteSpace(emoji)) throw new ArgumentException("Emoji is required");
            if (emoji.Length > 16) emoji = emoji.Substring(0, 16);
            _dal.ToggleReaction(messageId, userId, emoji);
        }

        public List<MessageReaction> GetThreadReactions(int userA, int userB)
        {
            if (userA <= 0 || userB <= 0) throw new ArgumentException("Both user ids must be positive");
            return _dal.GetThreadReactions(userA, userB);
        }
    }
}
