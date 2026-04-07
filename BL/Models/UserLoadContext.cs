namespace TrainWise.BL.Models
{
    public class UserLoadContext
    {
        public bool IsBaselineEstablished { get; set; }
        public short BaseLineDailyLoad { get; set; }
        public byte ExperienceLevel { get; set; }
        public bool HasActiveInjury { get; set; }
        public LoadParameters Parameters { get; set; }
    }
}


