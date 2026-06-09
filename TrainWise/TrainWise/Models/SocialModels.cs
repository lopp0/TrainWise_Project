namespace TrainWise.BL.Models
{
    // ── Friends ──────────────────────────────────────────────────────────
    // A friend (or incoming request) as seen by the current user, with presence.
    public class FriendContact
    {
        public int FriendUserID { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string ProfileImagePath { get; set; }
        public int ExperienceLevel { get; set; }
        public DateTime? LastSeen { get; set; }
        public bool IsOnline { get; set; }
        public int FriendshipID { get; set; }
    }

    public class Friendship
    {
        public int FriendshipID { get; set; }
        public int RequesterID { get; set; }
        public int AddresseeID { get; set; }
        public string Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? RespondedAt { get; set; }
    }

    // ── Map / discovery ──────────────────────────────────────────────────
    public class NearbyUser
    {
        public int UserID { get; set; }
        public string FullName { get; set; }
        public string ProfileImagePath { get; set; }
        public int ExperienceLevel { get; set; }
        public bool IsCoach { get; set; }
        public bool IsTrainee { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public DateTime? LastSeen { get; set; }
        public bool IsOnline { get; set; }
        public double DistanceKm { get; set; }
    }

    // Quick-look profile shown when a pin is tapped.
    public class UserMiniProfile
    {
        public int UserID { get; set; }
        public string FullName { get; set; }
        public string ProfileImagePath { get; set; }
        public int ExperienceLevel { get; set; }
        public bool IsCoach { get; set; }
        public bool IsTrainee { get; set; }
        public DateTime? LastSeen { get; set; }
        public bool IsOnline { get; set; }
        public string TopActivities { get; set; }       // comma-separated top-3 type names
        public string FriendStatus { get; set; }         // null | pending | accepted | declined
        public int? FriendRequesterID { get; set; }      // who initiated the pending request
        public int? FriendshipID { get; set; }
    }

    // ── Gyms ─────────────────────────────────────────────────────────────
    public class Gym
    {
        public int GymID { get; set; }
        public string Name { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string Description { get; set; }
        public decimal? Rating { get; set; }
        public string Phone { get; set; }
        public string PhotoPath { get; set; }
        public double DistanceKm { get; set; }
        public int CoachCount { get; set; }
    }

    public class GymCoachContact
    {
        public int UserID { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string ProfileImagePath { get; set; }
        public int ExperienceLevel { get; set; }
        public DateTime? LastSeen { get; set; }
        public bool IsOnline { get; set; }
    }

    // Lightweight gym reference (the gyms a coach is recommended at).
    public class GymRef
    {
        public int GymID { get; set; }
        public string Name { get; set; }
        public string Address { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }

    // ── Coach offers (coach -> trainee) ──────────────────────────────────
    public class CoachOffer
    {
        public int OfferID { get; set; }
        public int CoachUserID { get; set; }
        public int TraineeUserID { get; set; }
        public string Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? RespondedAt { get; set; }
    }

    // A pending offer as seen by the trainee, with the coach's contact.
    public class CoachOfferContact
    {
        public int OfferID { get; set; }
        public int CoachUserID { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string ProfileImagePath { get; set; }
        public int ExperienceLevel { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ── Request DTOs ─────────────────────────────────────────────────────
    public class UpdateLocationRequest
    {
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }
}
