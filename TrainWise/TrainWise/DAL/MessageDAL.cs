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
                    {"@ImagePath", (object)m.ImagePath ?? DBNull.Value},
                    {"@AudioPath", (object)m.AudioPath ?? DBNull.Value},
                    {"@VideoPath", (object)m.VideoPath ?? DBNull.Value}
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

        // #138 — typing indicator. Upsert "from is typing to" with a fresh
        // timestamp; the peer's poll treats a timestamp within ~6s as "typing".
        public void SetTyping(int fromUserId, int toUserId, bool isTyping)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
MERGE dbo.MessageTyping AS t
USING (SELECT @from AS FromUserID, @to AS ToUserID) AS s
   ON t.FromUserID = s.FromUserID AND t.ToUserID = s.ToUserID
WHEN MATCHED THEN UPDATE SET UpdatedAt = SYSUTCDATETIME(), IsTyping = @typing
WHEN NOT MATCHED THEN INSERT (FromUserID, ToUserID, UpdatedAt, IsTyping)
     VALUES (@from, @to, SYSUTCDATETIME(), @typing);", con);
            cmd.Parameters.AddWithValue("@from", fromUserId);
            cmd.Parameters.AddWithValue("@to", toUserId);
            cmd.Parameters.AddWithValue("@typing", isTyping);
            cmd.ExecuteNonQuery();
        }

        // Is @fromUserId currently typing to @toUserId? True only when flagged
        // typing AND the ping is fresh (last 6 seconds).
        public bool IsTyping(int fromUserId, int toUserId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM dbo.MessageTyping
    WHERE FromUserID = @from AND ToUserID = @to AND IsTyping = 1
      AND UpdatedAt >= DATEADD(SECOND, -6, SYSUTCDATETIME())
) THEN 1 ELSE 0 END;", con);
            cmd.Parameters.AddWithValue("@from", fromUserId);
            cmd.Parameters.AddWithValue("@to", toUserId);
            return Convert.ToInt32(cmd.ExecuteScalar()) == 1;
        }

        // #140 — toggle an emoji reaction on a message (one reaction per user per
        // message; re-sending the same emoji removes it, a different one replaces).
        public void ToggleReaction(int messageId, int userId, string emoji)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
IF EXISTS (SELECT 1 FROM dbo.MessageReactions WHERE MessageID = @m AND UserID = @u AND Emoji = @e)
    DELETE FROM dbo.MessageReactions WHERE MessageID = @m AND UserID = @u;
ELSE
BEGIN
    DELETE FROM dbo.MessageReactions WHERE MessageID = @m AND UserID = @u;
    INSERT INTO dbo.MessageReactions (MessageID, UserID, Emoji) VALUES (@m, @u, @e);
END", con);
            cmd.Parameters.AddWithValue("@m", messageId);
            cmd.Parameters.AddWithValue("@u", userId);
            cmd.Parameters.AddWithValue("@e", emoji);
            cmd.ExecuteNonQuery();
        }

        // All reactions on messages in the A<->B thread (so bubbles can show them).
        public List<MessageReaction> GetThreadReactions(int userA, int userB)
        {
            var list = new List<MessageReaction>();
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(@"
SELECT r.MessageID, r.UserID, r.Emoji
FROM dbo.MessageReactions r
JOIN dbo.Messages m ON m.MessageID = r.MessageID
WHERE (m.SenderID = @a AND m.ReceiverID = @b)
   OR (m.SenderID = @b AND m.ReceiverID = @a);", con);
            cmd.Parameters.AddWithValue("@a", userA);
            cmd.Parameters.AddWithValue("@b", userB);
            using var r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new MessageReaction
                {
                    MessageID = Convert.ToInt32(r["MessageID"]),
                    UserID = Convert.ToInt32(r["UserID"]),
                    Emoji = r["Emoji"].ToString()
                });
            return list;
        }

        private static Message Map(SqlDataReader reader) => new Message
        {
            MessageID = (int)reader["MessageID"],
            SenderID = (int)reader["SenderID"],
            ReceiverID = (int)reader["ReceiverID"],
            Text = reader["Text"].ToString(),
            SentAt = (DateTime)reader["SentAt"],
            IsSeen = (bool)reader["IsSeen"],
            ImagePath = reader["ImagePath"] == DBNull.Value ? null : reader["ImagePath"].ToString(),
            AudioPath = HasColumn(reader, "AudioPath") && reader["AudioPath"] != DBNull.Value ? reader["AudioPath"].ToString() : null,
            VideoPath = HasColumn(reader, "VideoPath") && reader["VideoPath"] != DBNull.Value ? reader["VideoPath"].ToString() : null
        };

        // Defensive column check so the mapper still works if an older proc that
        // doesn't SELECT the media columns is deployed (e.g. before the migration).
        private static bool HasColumn(SqlDataReader reader, string name)
        {
            for (int i = 0; i < reader.FieldCount; i++)
                if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                    return true;
            return false;
        }
    }
}
