namespace TrainWise.BL.Models
{
    public class LoadParameters
    {
        public int ParamID { get; set; }

        public short BeginnerDailyLoad { get; set; }    // 200
        public short RegularDailyLoad { get; set; }     // 350
        public short AdvanceDailyLoad { get; set; }     // 500
        public short BeginnerAcuteLoad { get; set; }    // 150
        public short RegularAcuteLoad { get; set; }     // 280
        public short AdvanceAcuteLoad { get; set; }     // 420
        public double LowLoadRatio { get; set; }        // 0.8
        public double SafeZoneLowRange { get; set; }    // 0.8
        public double SafeZoneHighRange { get; set; }   // 1.3
        public double OverLoad { get; set; }            // 1.5
    }
}
