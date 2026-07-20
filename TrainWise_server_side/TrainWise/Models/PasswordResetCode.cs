namespace TrainWise.BL.Models
{
    public class PasswordResetCode
    {
        public int ResetID { get; set; }
        public int UserID { get; set; }
        public string CodeHash { get; set; }
        public DateTime ExpiresAt { get; set; }
        public int Attempts { get; set; }
        public bool Used { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
