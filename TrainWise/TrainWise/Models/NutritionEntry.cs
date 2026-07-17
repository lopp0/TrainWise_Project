namespace TrainWise.BL.Models
{
    // #132 — one hydration/nutrition log entry. Kind is "food" (uses Calories +
    // optional Name/Barcode) or "water" (uses WaterMl).
    public class NutritionEntry
    {
        public int EntryID { get; set; }
        public int UserID { get; set; }
        public DateTime LoggedAt { get; set; }
        public string Kind { get; set; }
        public string? Name { get; set; }
        public int? Calories { get; set; }
        public int? WaterMl { get; set; }
        public string? Barcode { get; set; }
    }
}
