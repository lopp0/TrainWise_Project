using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // #132 — hydration & nutrition. Validates + clamps every field server-side
    // (client validation is UX only) before writing.
    public class NutritionBL
    {
        private readonly NutritionDAL _dal = new NutritionDAL();

        private const int MaxCalories = 10000; // per single entry
        private const int MaxWaterMl = 5000;   // per single entry
        private const int MaxNameLen = 120;
        private const int MaxBarcodeLen = 32;

        public NutritionEntry Add(NutritionEntry e)
        {
            if (e.UserID <= 0) throw new ArgumentException("UserID is required");

            string kind = (e.Kind ?? "").Trim().ToLowerInvariant();
            if (kind != "food" && kind != "water")
                throw new ArgumentException("Kind must be 'food' or 'water'");
            e.Kind = kind;

            if (kind == "food")
            {
                int cals = e.Calories ?? 0;
                if (cals < 0) cals = 0;
                if (cals > MaxCalories) cals = MaxCalories;
                e.Calories = cals;
                e.WaterMl = null;
                if (!string.IsNullOrWhiteSpace(e.Name))
                    e.Name = e.Name.Trim().Length > MaxNameLen ? e.Name.Trim()[..MaxNameLen] : e.Name.Trim();
                if (!string.IsNullOrWhiteSpace(e.Barcode))
                    e.Barcode = e.Barcode.Trim().Length > MaxBarcodeLen ? e.Barcode.Trim()[..MaxBarcodeLen] : e.Barcode.Trim();
            }
            else // water
            {
                int ml = e.WaterMl ?? 0;
                if (ml <= 0) throw new ArgumentException("WaterMl must be positive for a water entry");
                if (ml > MaxWaterMl) ml = MaxWaterMl;
                e.WaterMl = ml;
                e.Calories = null;
                e.Name = null;
                e.Barcode = null;
            }

            return _dal.Insert(e);
        }

        public List<NutritionEntry> GetForRange(int userId, DateTime fromUtc, DateTime toUtc)
        {
            if (userId <= 0) throw new ArgumentException("UserID is required");
            return _dal.GetForRange(userId, fromUtc, toUtc);
        }

        public int? GetOwnerUserId(int entryId) => _dal.GetOwnerUserId(entryId);

        public void Delete(int entryId)
        {
            if (entryId <= 0) throw new ArgumentException("EntryID is required");
            _dal.Delete(entryId);
        }
    }
}
