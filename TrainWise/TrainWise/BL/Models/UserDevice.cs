namespace TrainWise.BL.Models
{
    public class UserDevice
    {
        public int DeviceID { get; set; }
        public int UserID { get; set; }
        public string DeviceName { get; set; }
        public DateTime LastSync { get; set; }
        public bool PermissionsGranted { get; set; }
    }
}
