namespace TrainWise.BL.Models
{
    // A-5 — personal records + earned badges.
    public class PersonalRecord
    {
        public int RecordId { get; set; }
        public int UserID { get; set; }
        public int? ActivityTypeId { get; set; }   // null = all-activity record
        public string MetricType { get; set; }
        public double RecordValue { get; set; }
        public DateTime AchievedAt { get; set; }
        public int? LinkedLogId { get; set; }
    }

    public class EarnedBadge
    {
        public int BadgeId { get; set; }
        public int UserID { get; set; }
        public string BadgeKey { get; set; }
        public DateTime EarnedAt { get; set; }
    }

    public class RecordsResult
    {
        public List<PersonalRecord> Records { get; set; } = new List<PersonalRecord>();
        public List<EarnedBadge> Badges { get; set; } = new List<EarnedBadge>();
        // Badge keys earned in THIS check call (drives the celebratory modal).
        public List<string> NewBadges { get; set; } = new List<string>();
    }
}
