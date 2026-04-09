namespace TrainWise.BL.Models
{
    public class UpdateUserRequest
    {
        public int UserID { get; set; }
        public string FullName { get; set; }
        public int BirthYear { get; set; }
        public string Gender { get; set; }
        public int Height { get; set; }
        public int Weight { get; set; }
        public int ActivityLevel { get; set; }
        public string DeviceType { get; set; }
        public byte ExperienceLevel { get; set; }
    }
}
