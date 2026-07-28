namespace TrainWise.BL.Models
{
    // #131 — a body-measurement entry (weight in kg, optional body-fat %).
    public class BodyMeasurement
    {
        public int MeasurementID { get; set; }
        public int UserID { get; set; }
        public DateTime MeasuredAt { get; set; }
        public double Weight { get; set; }
        public double? BodyFat { get; set; }
    }
}
