namespace TrainWise.BL.Models
{
    /// <summary>
    /// One active login of one account on one device (2026-07-19 security pass).
    /// Returned to the Settings "Devices &amp; sessions" screen. Never exposes the
    /// TokenId — only the session id is needed to revoke.
    /// </summary>
    public class UserSession
    {
        public int SessionId { get; set; }
        public int UserId { get; set; }
        public string? DeviceName { get; set; }
        public string? Platform { get; set; }
        public string? AppVersion { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastSeenAt { get; set; }
        /// <summary>True for the session making the request (the phone in your hand).</summary>
        public bool IsCurrent { get; set; }
    }
}
