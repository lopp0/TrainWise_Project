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
            if (!hasText && !hasImage)
                throw new ArgumentException("Message text or image is required");

            if (_userDal.GetUserById(m.SenderID) == null)
                throw new ArgumentException("Sender does not exist");
            if (_userDal.GetUserById(m.ReceiverID) == null)
                throw new ArgumentException("Receiver does not exist");

            // Image-only messages send an empty text (column is NOT NULL).
            m.Text = hasText ? m.Text.Trim() : "";
            if (m.Text.Length > MaxTextLength)
                m.Text = m.Text.Substring(0, MaxTextLength);

            return _dal.Insert(m);
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
    }
}
