namespace TrainWise.BL.Models
{
    public class CreateDeviceRequest
    {
        public int UserID { get; set; }
        public string DeviceName { get; set; }
        public DateTime LastSync { get; set; }
        public bool PermissionsGranted { get; set; }
    }
}
