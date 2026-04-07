namespace TrainWise.BL.Models
{
    public class CreateUserRequest
    {
        public string FullName { get; set; }
        public int BirthYear { get; set; }
        public string Gender { get; set; }
        public int Height { get; set; }
        public int Weight { get; set; }
        public int ActivityLevel { get; set; }
        public string DeviceType { get; set; }
        public string UserName { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
        public byte ExperienceLevel { get; set; }
        public bool HealthDeclaration { get; set; }
        public bool ConfirmTerms { get; set; }
        public DateTime? TermConfirmationDate { get; set; }
        public bool IsCoach { get; set; }
    }
}
