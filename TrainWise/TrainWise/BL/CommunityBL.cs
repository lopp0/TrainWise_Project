using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // Business logic for the community medium batch (#142/#144/#145/#169).
    // Validation + clamping live here; the DAL is pure data access.
    public class CommunityBL
    {
        private readonly CommunityDAL _dal = new CommunityDAL();

        // ── #142 Challenges ──────────────────────────────────────────────
        public int CreateChallenge(CreateChallengeRequest req)
        {
            if (req == null) throw new ArgumentException("Body required");
            if (string.IsNullOrWhiteSpace(req.Title)) throw new ArgumentException("Title is required");
            if (req.Title.Length > 120) req.Title = req.Title.Substring(0, 120);
            var metric = (req.Metric ?? "load").ToLowerInvariant();
            if (metric != "load" && metric != "workouts" && metric != "distance") metric = "load";
            var start = req.StartDate.Date;
            var end = req.EndDate.Date;
            if (end < start) throw new ArgumentException("End date must be on or after the start date");
            if ((end - start).TotalDays > 90) throw new ArgumentException("A challenge can span at most 90 days");
            return _dal.CreateChallenge(req.CreatorID, req.Title.Trim(), metric, start, end, req.InviteeCsv);
        }

        public void JoinChallenge(int challengeId, int userId) => _dal.JoinChallenge(challengeId, userId);
        public void LeaveChallenge(int challengeId, int userId) => _dal.LeaveChallenge(challengeId, userId);
        public List<Challenge> GetChallengesForUser(int userId) => _dal.GetChallengesForUser(userId);
        public List<Challenge> GetChallengeInvites(int userId) => _dal.GetChallengeInvites(userId);
        public void RespondChallengeInvite(int challengeId, int userId, bool accept) => _dal.RespondChallengeInvite(challengeId, userId, accept);
        public List<ChallengeStanding> GetChallengeStandings(int challengeId) => _dal.GetChallengeStandings(challengeId);
        public int GetChallengeCreator(int challengeId) => _dal.GetChallengeCreator(challengeId);

        // ── #145 Events ──────────────────────────────────────────────────
        public int CreateEvent(CreateEventRequest req)
        {
            if (req == null) throw new ArgumentException("Body required");
            if (string.IsNullOrWhiteSpace(req.Title)) throw new ArgumentException("Title is required");
            if (req.Title.Length > 120) req.Title = req.Title.Substring(0, 120);
            if (req.Description != null && req.Description.Length > 600) req.Description = req.Description.Substring(0, 600);
            req.Title = req.Title.Trim();
            return _dal.CreateEvent(req);
        }

        public void RsvpEvent(int eventId, int userId, string status)
        {
            var s = (status ?? "going").ToLowerInvariant();
            if (s != "going" && s != "maybe" && s != "no") s = "going";
            _dal.RsvpEvent(eventId, userId, s);
        }

        public int DeleteEvent(int eventId, int userId) => _dal.DeleteEvent(eventId, userId);
        public List<EventItem> GetEventsForUser(int userId) => _dal.GetEventsForUser(userId);
        public List<EventAttendee> GetEventAttendees(int eventId) => _dal.GetEventAttendees(eventId);
        public int GetEventCreator(int eventId) => _dal.GetEventCreator(eventId);

        // #145 group chat — only attendees (creator or going/maybe RSVP) may read/post.
        public bool IsEventParticipant(int eventId, int userId) => _dal.IsEventParticipant(eventId, userId);

        // Reading the thread also marks it seen for this user (read receipts, #7).
        public List<EventMessage> GetEventMessages(int eventId, int userId)
        {
            if (!_dal.IsEventParticipant(eventId, userId))
                throw new ArgumentException("Join this event to see its chat");
            _dal.MarkEventMessagesSeen(eventId, userId);
            return _dal.GetEventMessages(eventId);
        }

        // #7 — a message may be text, image, video or a voice note. At least one
        // of them must be present (mirrors MessageBL, which allows image-only).
        public EventMessage PostEventMessage(int eventId, int senderId, string text, string imagePath, string videoPath, string audioPath)
        {
            var hasMedia = !string.IsNullOrWhiteSpace(imagePath)
                        || !string.IsNullOrWhiteSpace(videoPath)
                        || !string.IsNullOrWhiteSpace(audioPath);
            if (string.IsNullOrWhiteSpace(text) && !hasMedia)
                throw new ArgumentException("Message cannot be empty");
            if (!string.IsNullOrWhiteSpace(text))
            {
                text = text.Trim();
                if (text.Length > 1000) text = text.Substring(0, 1000);
            }
            else text = null;

            if (!_dal.IsEventParticipant(eventId, senderId))
                throw new ArgumentException("Join this event to post in its chat");
            return _dal.PostEventMessage(eventId, senderId, text, imagePath, videoPath, audioPath);
        }

        // #7 — emoji reactions on group messages.
        public void ReactEventMessage(int eventId, int messageId, int userId, string emoji)
        {
            if (string.IsNullOrWhiteSpace(emoji)) throw new ArgumentException("Emoji is required");
            if (emoji.Length > 16) emoji = emoji.Substring(0, 16);
            if (!_dal.IsEventParticipant(eventId, userId))
                throw new ArgumentException("Join this event to react in its chat");
            _dal.ReactEventMessage(messageId, userId, emoji);
        }

        public List<EventMessageReaction> GetEventReactions(int eventId, int userId)
        {
            if (!_dal.IsEventParticipant(eventId, userId))
                throw new ArgumentException("Join this event to see its chat");
            return _dal.GetEventReactions(eventId);
        }

        // ── #169 Coach marketplace + reviews ─────────────────────────────
        public List<CoachMarketplaceItem> GetCoachMarketplace(int viewerId, string search, string sort)
        {
            var s = (sort ?? "rating").ToLowerInvariant();
            if (s != "rating" && s != "name") s = "rating";
            if (search != null && search.Length > 120) search = search.Substring(0, 120);
            return _dal.GetCoachMarketplace(viewerId, search, s);
        }

        public List<CoachReview> GetCoachReviews(int coachUserId) => _dal.GetCoachReviews(coachUserId);

        // Only a (current/former) trainee of the coach may leave a review.
        public void UpsertCoachReview(int coachUserId, int reviewerId, int rating, string text)
        {
            if (coachUserId == reviewerId) throw new ArgumentException("You can't review yourself");
            if (!_dal.IsTraineeOfCoach(coachUserId, reviewerId))
                throw new ArgumentException("Only the coach's trainees can leave a review");
            if (text != null && text.Length > 600) text = text.Substring(0, 600);
            _dal.UpsertCoachReview(coachUserId, reviewerId, Math.Clamp(rating, 1, 5), text);
        }

        // ── #144 Activity feed ───────────────────────────────────────────
        public List<FeedItem> GetActivityFeed(int userId, int limit) => _dal.GetActivityFeed(userId, Math.Clamp(limit, 1, 100));
    }
}
