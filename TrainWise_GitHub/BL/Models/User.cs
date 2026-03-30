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

    }
}
