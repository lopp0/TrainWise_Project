using Microsoft.Data.SqlClient;
using TrainWise.BL.Models;

namespace TrainWise.DAL
{
    // Data access for the community medium batch: #142 challenges, #145 events,
    // #169 coach marketplace/reviews, #144 activity feed. Same ADO.NET / stored-
    // procedure idiom as SocialDAL.
    public class CommunityDAL : DBservice
    {
        private static bool Has(SqlDataReader r, string col)
        {
            for (int i = 0; i < r.FieldCount; i++)
                if (string.Equals(r.GetName(i), col, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }
        private static string Str(SqlDataReader r, string c) => r[c] == DBNull.Value ? null : r[c].ToString();
        private static int Int(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToInt32(r[c]);
        private static double Dbl(SqlDataReader r, string c) => r[c] == DBNull.Value ? 0 : Convert.ToDouble(r[c]);
        private static double? DblN(SqlDataReader r, string c) => r[c] == DBNull.Value ? (double?)null : Convert.ToDouble(r[c]);
        private static bool Bool(SqlDataReader r, string c) => r[c] != DBNull.Value && Convert.ToBoolean(r[c]);
        private static DateTime Dt(SqlDataReader r, string c) => r[c] == DBNull.Value ? default : Convert.ToDateTime(r[c]);

        // ── #142 Challenges ──────────────────────────────────────────────
        public int CreateChallenge(int creatorId, string title, string metric, DateTime start, DateTime end, string inviteeCsv)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@CreatorID", creatorId }, { "@Title", title }, { "@Metric", metric },
                { "@StartDate", start.Date }, { "@EndDate", end.Date },
                { "@InviteeCsv", (object)inviteeCsv ?? DBNull.Value }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_CreateChallenge", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            return r.Read() ? Int(r, "ChallengeID") : 0;
        }

        public void JoinChallenge(int challengeId, int userId) => Exec2("sp_JoinChallenge", "@ChallengeID", challengeId, "@UserID", userId);
        public void LeaveChallenge(int challengeId, int userId) => Exec2("sp_LeaveChallenge", "@ChallengeID", challengeId, "@UserID", userId);

        public List<Challenge> GetChallengesForUser(int userId)
        {
            var list = new List<Challenge>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserID", userId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetChallengesForUser", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new Challenge
                {
                    ChallengeID = Int(r, "ChallengeID"),
                    CreatorID = Int(r, "CreatorID"),
                    CreatorName = Str(r, "CreatorName"),
                    Title = Str(r, "Title"),
                    Metric = Str(r, "Metric"),
                    StartDate = Dt(r, "StartDate"),
                    EndDate = Dt(r, "EndDate"),
                    CreatedAt = Dt(r, "CreatedAt"),
                    ParticipantCount = Int(r, "ParticipantCount"),
                    Status = Str(r, "Status")
                });
            return list;
        }

        public List<ChallengeStanding> GetChallengeStandings(int challengeId)
        {
            var list = new List<ChallengeStanding>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@ChallengeID", challengeId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetChallengeStandings", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new ChallengeStanding
                {
                    UserID = Int(r, "UserID"),
                    FullName = Str(r, "FullName"),
                    ProfileImagePath = Str(r, "ProfileImagePath"),
                    ExperienceLevel = Has(r, "ExperienceLevel") ? Int(r, "ExperienceLevel") : 0,
                    EquippedBadge = Has(r, "EquippedBadge") ? Str(r, "EquippedBadge") : null,
                    EquippedTitle = Has(r, "EquippedTitle") ? Str(r, "EquippedTitle") : null,
                    EquippedFrame = Has(r, "EquippedFrame") ? Str(r, "EquippedFrame") : null,
                    Score = Dbl(r, "Score")
                });
            return list;
        }

        // Pending invitations for the user (reuses the Challenge model shape).
        public List<Challenge> GetChallengeInvites(int userId)
        {
            var list = new List<Challenge>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserID", userId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetChallengeInvites", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new Challenge
                {
                    ChallengeID = Int(r, "ChallengeID"),
                    CreatorID = Int(r, "CreatorID"),
                    CreatorName = Str(r, "CreatorName"),
                    Title = Str(r, "Title"),
                    Metric = Str(r, "Metric"),
                    StartDate = Dt(r, "StartDate"),
                    EndDate = Dt(r, "EndDate"),
                    CreatedAt = Dt(r, "CreatedAt"),
                    ParticipantCount = Int(r, "ParticipantCount"),
                    Status = Str(r, "Status")
                });
            return list;
        }

        public void RespondChallengeInvite(int challengeId, int userId, bool accept)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@ChallengeID", challengeId }, { "@UserID", userId }, { "@Accept", accept }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_RespondChallengeInvite", con, p);
            cmd.ExecuteNonQuery();
        }

        // ── #145 Events ──────────────────────────────────────────────────
        public int CreateEvent(CreateEventRequest req)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@CreatorID", req.CreatorID }, { "@Title", req.Title },
                { "@Description", (object)req.Description ?? DBNull.Value },
                { "@EventTime", req.EventTime },
                { "@LocationName", (object)req.LocationName ?? DBNull.Value },
                { "@Latitude", (object)req.Latitude ?? DBNull.Value },
                { "@Longitude", (object)req.Longitude ?? DBNull.Value }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_CreateEvent", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            return r.Read() ? Int(r, "EventID") : 0;
        }

        public void RsvpEvent(int eventId, int userId, string status)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@EventID", eventId }, { "@UserID", userId }, { "@Status", status } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_RsvpEvent", con, p);
            cmd.ExecuteNonQuery();
        }

        public int DeleteEvent(int eventId, int userId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@EventID", eventId }, { "@UserID", userId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_DeleteEvent", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            return r.Read() ? Int(r, "deleted") : 0;
        }

        public List<EventItem> GetEventsForUser(int userId)
        {
            var list = new List<EventItem>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserID", userId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetEventsForUser", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new EventItem
                {
                    EventID = Int(r, "EventID"),
                    CreatorID = Int(r, "CreatorID"),
                    CreatorName = Str(r, "CreatorName"),
                    CreatorImage = Str(r, "CreatorImage"),
                    Title = Str(r, "Title"),
                    Description = Str(r, "Description"),
                    EventTime = Dt(r, "EventTime"),
                    LocationName = Str(r, "LocationName"),
                    Latitude = DblN(r, "Latitude"),
                    Longitude = DblN(r, "Longitude"),
                    CreatedAt = Dt(r, "CreatedAt"),
                    GoingCount = Int(r, "GoingCount"),
                    MyStatus = Str(r, "MyStatus")
                });
            return list;
        }

        // #145 group chat
        public bool IsEventParticipant(int eventId, int userId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@EventId", eventId }, { "@UserId", userId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_IsEventParticipant", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            return r.Read() && Bool(r, "IsParticipant");
        }

        // #7 — a message may carry text and/or an image, video or voice note.
        // Returns the full saved row so the client can append without re-fetching.
        public EventMessage PostEventMessage(int eventId, int senderId, string text, string imagePath, string videoPath, string audioPath)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@EventId", eventId },
                { "@SenderId", senderId },
                { "@Text", (object)text ?? DBNull.Value },
                { "@ImagePath", (object)imagePath ?? DBNull.Value },
                { "@VideoPath", (object)videoPath ?? DBNull.Value },
                { "@AudioPath", (object)audioPath ?? DBNull.Value }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_PostEventMessage", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            return r.Read() ? MapEventMessage(r) : null;
        }

        public List<EventMessage> GetEventMessages(int eventId)
        {
            var list = new List<EventMessage>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@EventId", eventId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetEventMessages", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read()) list.Add(MapEventMessage(r));
            return list;
        }

        // Shared mapper. The media / SeenCount columns are guarded with Has(...)
        // because Str/Int index the reader by name and would throw if the
        // 2026-07-19_event_chat_full migration hasn't been applied yet. This way
        // an un-migrated DB still returns plain text messages.
        private static EventMessage MapEventMessage(SqlDataReader r) => new EventMessage
        {
            MessageId = Int(r, "MessageId"),
            EventId = Int(r, "EventId"),
            SenderId = Int(r, "SenderId"),
            SenderName = Str(r, "SenderName"),
            SenderImage = Str(r, "SenderImage"),
            Text = Str(r, "Text"),
            ImagePath = Has(r, "ImagePath") ? Str(r, "ImagePath") : null,
            VideoPath = Has(r, "VideoPath") ? Str(r, "VideoPath") : null,
            AudioPath = Has(r, "AudioPath") ? Str(r, "AudioPath") : null,
            SeenCount = Has(r, "SeenCount") ? Int(r, "SeenCount") : 0,
            CreatedAt = Dt(r, "CreatedAt")
        };

        // #7 — read receipts: mark everything the user didn't send as read.
        public void MarkEventMessagesSeen(int eventId, int userId)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@EventId", eventId }, { "@UserId", userId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_MarkEventMessagesSeen", con, p);
            cmd.ExecuteNonQuery();
        }

        // #7 — toggle one emoji reaction (same emoji removes, different replaces).
        public void ReactEventMessage(int messageId, int userId, string emoji)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@MessageId", messageId }, { "@UserId", userId }, { "@Emoji", emoji }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_ReactEventMessage", con, p);
            cmd.ExecuteNonQuery();
        }

        public List<EventMessageReaction> GetEventReactions(int eventId)
        {
            var list = new List<EventMessageReaction>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@EventId", eventId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetEventReactions", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new EventMessageReaction
                {
                    MessageId = Int(r, "MessageId"),
                    UserId = Int(r, "UserId"),
                    Emoji = Str(r, "Emoji")
                });
            return list;
        }

        public List<EventAttendee> GetEventAttendees(int eventId)
        {
            var list = new List<EventAttendee>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@EventID", eventId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetEventAttendees", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new EventAttendee
                {
                    UserID = Int(r, "UserID"),
                    FullName = Str(r, "FullName"),
                    ProfileImagePath = Str(r, "ProfileImagePath"),
                    Status = Str(r, "Status")
                });
            return list;
        }

        // ── #169 Coach marketplace + reviews ─────────────────────────────
        public List<CoachMarketplaceItem> GetCoachMarketplace(int viewerId, string search, string sort)
        {
            var list = new List<CoachMarketplaceItem>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@ViewerID", viewerId },
                { "@Search", (object)search ?? DBNull.Value },
                { "@Sort", sort }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetCoachMarketplace", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new CoachMarketplaceItem
                {
                    UserID = Int(r, "UserID"),
                    FullName = Str(r, "FullName"),
                    ProfileImagePath = Str(r, "ProfileImagePath"),
                    ExperienceLevel = Int(r, "ExperienceLevel"),
                    IsOnline = Bool(r, "IsOnline"),
                    AvgRating = Dbl(r, "AvgRating"),
                    ReviewCount = Int(r, "ReviewCount"),
                    TraineeCount = Int(r, "TraineeCount"),
                    IsMyCoach = Bool(r, "IsMyCoach")
                });
            return list;
        }

        public List<CoachReview> GetCoachReviews(int coachUserId)
        {
            var list = new List<CoachReview>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@CoachUserID", coachUserId } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetCoachReviews", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new CoachReview
                {
                    ReviewID = Int(r, "ReviewID"),
                    CoachUserID = Int(r, "CoachUserID"),
                    ReviewerUserID = Int(r, "ReviewerUserID"),
                    ReviewerName = Str(r, "ReviewerName"),
                    ReviewerImage = Str(r, "ReviewerImage"),
                    Rating = Int(r, "Rating"),
                    Text = Str(r, "Text"),
                    CreatedAt = Dt(r, "CreatedAt")
                });
            return list;
        }

        public void UpsertCoachReview(int coachUserId, int reviewerId, int rating, string text)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object>
            {
                { "@CoachUserID", coachUserId }, { "@ReviewerUserID", reviewerId },
                { "@Rating", (byte)Math.Clamp(rating, 1, 5) }, { "@Text", (object)text ?? DBNull.Value }
            };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_UpsertCoachReview", con, p);
            cmd.ExecuteNonQuery();
        }

        // Whether the reviewer is a (current) trainee of the coach — gates reviews.
        public bool IsTraineeOfCoach(int coachUserId, int reviewerId)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(
                @"SELECT COUNT(*) FROM dbo.CoachTrainees ct
                  JOIN dbo.Coaches co ON co.CoachID = ct.CoachID
                  WHERE co.UserID = @coach AND ct.UserID = @rev", con);
            cmd.Parameters.AddWithValue("@coach", coachUserId);
            cmd.Parameters.AddWithValue("@rev", reviewerId);
            return Convert.ToInt32(cmd.ExecuteScalar()) > 0;
        }

        // Owner lookups for authorising by-id writes.
        public int GetChallengeCreator(int challengeId) => ScalarInt("SELECT CreatorID FROM dbo.Challenges WHERE ChallengeID=@id", challengeId);
        public int GetEventCreator(int eventId) => ScalarInt("SELECT CreatorID FROM dbo.Events WHERE EventID=@id", eventId);

        // ── #144 Activity feed ───────────────────────────────────────────
        public List<FeedItem> GetActivityFeed(int userId, int limit)
        {
            var list = new List<FeedItem>();
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { "@UserID", userId }, { "@Limit", limit } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure("sp_GetActivityFeed", con, p);
            using SqlDataReader r = cmd.ExecuteReader();
            while (r.Read())
                list.Add(new FeedItem
                {
                    FeedType = Str(r, "FeedType"),
                    RefID = Int(r, "RefID"),
                    ActorID = Int(r, "ActorID"),
                    ActorName = Str(r, "ActorName"),
                    ActorImage = Str(r, "ActorImage"),
                    Title = Str(r, "Title"),
                    Subtitle = Str(r, "Subtitle"),
                    ImagePath = Has(r, "ImagePath") ? Str(r, "ImagePath") : null,
                    CreatedAt = Dt(r, "CreatedAt")
                });
            return list;
        }

        // ── small helpers ────────────────────────────────────────────────
        private void Exec2(string sp, string k1, int v1, string k2, int v2)
        {
            using SqlConnection con = Connect();
            var p = new Dictionary<string, object> { { k1, v1 }, { k2, v2 } };
            using SqlCommand cmd = CreateCommandWithStoredProcedure(sp, con, p);
            cmd.ExecuteNonQuery();
        }

        private int ScalarInt(string sql, int id)
        {
            using SqlConnection con = Connect();
            using SqlCommand cmd = new SqlCommand(sql, con);
            cmd.Parameters.AddWithValue("@id", id);
            var o = cmd.ExecuteScalar();
            return o == null || o == DBNull.Value ? 0 : Convert.ToInt32(o);
        }
    }
}
