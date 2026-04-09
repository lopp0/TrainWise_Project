namespace TrainWise.BL.Models
{
    public class UpdateDeviceRequest
    {
        public string DeviceName { get; set; }
        public DateTime LastSync { get; set; }
        public bool PermissionsGranted { get; set; }
    }
}
