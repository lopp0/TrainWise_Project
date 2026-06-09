using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    public class MessageDAL : DBservice
    {
        // Inserts a message (server stamps SentAt in UTC, IsSeen=0) and returns
        // the fully materialized row so the caller gets the real MessageID/SentAt.
        public Message Insert(Message m)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@SenderID", m.SenderID},
                    {"@ReceiverID", m.ReceiverID},
                    {"@Text", m.Text},
                    {"@ImagePath", (object)m.ImagePath ?? DBNull.Value}
                };

                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_InsertMessage", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                        return Map(reader);
                }
            }
            return m;
        }

        // Full thread between two users (either direction), oldest first.
        public List<Message> GetConversation(int userA, int userB)
        {
            var list = new List<Message>();
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@UserA", userA},
                    {"@UserB", userB}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetConversation", con, param))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                        list.Add(Map(reader));
                }
            }
            return list;
        }

        // Marks every message FROM @SenderID TO @ReceiverID as seen — called when
        // the receiver opens the chat. Returns affected row count.
        public int MarkSeen(int senderId, int receiverId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object>
                {
                    {"@SenderID", senderId},
                    {"@ReceiverID", receiverId}
                };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_MarkMessagesSeen", con, param))
                {
                    return cmd.ExecuteNonQuery();
                }
            }
        }

        // Count of unseen messages addressed to @UserID (badge source).
        public int GetUnreadCount(int userId)
        {
            using (SqlConnection con = Connect())
            {
                var param = new Dictionary<string, object> { { "@UserID", userId } };
                using (SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetUnreadMessageCount", con, param))
                {
                    object n = cmd.ExecuteScalar();
                    return n == null || n == DBNull.Value ? 0 : Convert.ToInt32(n);
                }
            }
        }

        private static Message Map(SqlDataReader reader) => new Message
        {
            MessageID = (int)reader["MessageID"],
            SenderID = (int)reader["SenderID"],
            ReceiverID = (int)reader["ReceiverID"],
            Text = reader["Text"].ToString(),
            SentAt = (DateTime)reader["SentAt"],
            IsSeen = (bool)reader["IsSeen"],
            ImagePath = reader["ImagePath"] == DBNull.Value ? null : reader["ImagePath"].ToString()
        };
    }
}
