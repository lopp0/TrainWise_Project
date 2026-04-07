namespace TrainWise.BL.Models
{
    public class User
    {
        public int UserID { get; set; }
        public string FullName { get; set; }
        public int BirthYear { get; set; }
        public string Gender { get; set; }
        public int Height { get; set; }
        public int Weight { get; set; }
        public int ActivityLevel { get; set; }
        public DateTime CreatedAt { get; set; }
        public string DeviceType { get; set; }
        public string? ProfileImagePath { get; set; }
        public bool IsCoach { get; set; }
        public string UserName { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }

        public byte ExperienceLevel { get; set; }     
        public short BaseLineDailyLoad { get; set; }
        public short BaseLineWeeklyLoad { get; set; }
        public bool IsBaselineEstablished { get; set; }
        public DateTime? BaselineEstablishedDate { get; set; }

        public bool HealthDeclaration { get; set; }
        public bool ConfirmTerms { get; set; }
        public DateTime? TermConfirmationDate { get; set; }
    }
}

