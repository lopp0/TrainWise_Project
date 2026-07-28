namespace TrainWise.BL.Models
{
    // ── #142 Friend challenges ───────────────────────────────────────────
    public class Challenge
    {
        public int ChallengeID { get; set; }
        public int CreatorID { get; set; }
        public string CreatorName { get; set; }
        public string Title { get; set; }
        public string Metric { get; set; }          // load | workouts | distance
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public int ParticipantCount { get; set; }
        public string Status { get; set; }           // upcoming | active | ended
    }

    public class ChallengeStanding
    {
        public int UserID { get; set; }
        public string FullName { get; set; }
        public string ProfileImagePath { get; set; }
        public int ExperienceLevel { get; set; }
        public string EquippedBadge { get; set; }
        public string EquippedTitle { get; set; }
        public string EquippedFrame { get; set; }
        public double Score { get; set; }
    }

    // ── #145 Group events ────────────────────────────────────────────────
    public class EventItem
    {
        public int EventID { get; set; }
        public int CreatorID { get; set; }
        public string CreatorName { get; set; }
        public string CreatorImage { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public DateTime EventTime { get; set; }
        public string LocationName { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public DateTime CreatedAt { get; set; }
        public int GoingCount { get; set; }
        public string MyStatus { get; set; }         // going | maybe | no | null
    }

    public class EventAttendee
    {
        public int UserID { get; set; }
        public string FullName { get; set; }
        public string ProfileImagePath { get; set; }
        public string Status { get; set; }
    }

    // #145 group chat — one message in an event's discussion thread.
    // #7 (2026-07-19): media + read receipts, matching the 1:1 chat.
    public class EventMessage
    {
        public int MessageId { get; set; }
        public int EventId { get; set; }
        public int SenderId { get; set; }
        public string SenderName { get; set; }
        public string SenderImage { get; set; }
        public string? Text { get; set; }        // null on a media-only message
        public string? ImagePath { get; set; }
        public string? VideoPath { get; set; }
        public string? AudioPath { get; set; }
        public int SeenCount { get; set; }       // readers other than the sender
        public DateTime CreatedAt { get; set; }
    }

    // Every payload field is optional: a message may be text, image, video or a
    // voice note. Nullable-refs are ON, so these MUST be string? or model
    // validation 400s any message that omits one (see lessons 2026-06-07).
    public class PostEventMessageRequest
    {
        public int SenderId { get; set; }
        public string? Text { get; set; }
        public string? ImagePath { get; set; }
        public string? VideoPath { get; set; }
        public string? AudioPath { get; set; }
    }

    // One emoji per user per message.
    public class EventMessageReaction
    {
        public int MessageId { get; set; }
        public int UserId { get; set; }
        public string Emoji { get; set; }
    }

    public class ReactEventMessageRequest
    {
        public int UserId { get; set; }
        public string Emoji { get; set; }
    }

    // ── #169 Coach marketplace + reviews ─────────────────────────────────
    public class CoachMarketplaceItem
    {
        public int UserID { get; set; }
        public string FullName { get; set; }
        public string ProfileImagePath { get; set; }
        public int ExperienceLevel { get; set; }
        public bool IsOnline { get; set; }
        public double AvgRating { get; set; }
        public int ReviewCount { get; set; }
        public int TraineeCount { get; set; }
        public bool IsMyCoach { get; set; }
    }

    public class CoachReview
    {
        public int ReviewID { get; set; }
        public int CoachUserID { get; set; }
        public int ReviewerUserID { get; set; }
        public string ReviewerName { get; set; }
        public string ReviewerImage { get; set; }
        public int Rating { get; set; }
        public string Text { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ── #144 Activity feed ───────────────────────────────────────────────
    public class FeedItem
    {
        public string FeedType { get; set; }         // workout | post
        public int RefID { get; set; }
        public int ActorID { get; set; }
        public string ActorName { get; set; }
        public string ActorImage { get; set; }
        public string Title { get; set; }
        public string Subtitle { get; set; }
        public string ImagePath { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ── Request DTOs (nullable strings per nullable-refs rule) ────────────
    public class CreateChallengeRequest
    {
        public int CreatorID { get; set; }
        public string Title { get; set; }
        public string Metric { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        // Optional: comma-separated friend ids. MUST be string? — nullable-refs are
        // ON, so a plain `string` is implicitly [Required] and 400s when omitted.
        public string? InviteeCsv { get; set; }
    }

    public class CreateEventRequest
    {
        public int CreatorID { get; set; }
        public string Title { get; set; }
        // Description + LocationName are optional in the form. They MUST be string?
        // or model validation 400s ("[object Object]") whenever the user leaves the
        // optional boxes blank — the exact bug reported 2026-07-19.
        public string? Description { get; set; }
        public DateTime EventTime { get; set; }
        public string? LocationName { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
    }

    public class RsvpRequest
    {
        public int UserID { get; set; }
        public string Status { get; set; }
    }

    public class UpsertReviewRequest
    {
        public int ReviewerUserID { get; set; }
        public int Rating { get; set; }
        // A rating can be left without a written review → nullable.
        public string? Text { get; set; }
    }
}
