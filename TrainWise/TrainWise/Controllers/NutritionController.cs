using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    // #132 — hydration & nutrition logging.
    [ApiController]
    [Route("api/[controller]")]
    public class NutritionController : BaseApiController
    {
        private readonly NutritionBL _bl = new NutritionBL();

        // GET /api/nutrition/user/{userId}/day?date=YYYY-MM-DD&tzOffsetMinutes=180
        // Returns the entries + totals for the user's LOCAL calendar day. The
        // window is computed from the client's local date + tz so a 00:30 entry
        // buckets to the right day regardless of the server running in UTC.
        [HttpGet("user/{userId:int}/day")]
        public IActionResult GetDay(int userId, [FromQuery] string? date, [FromQuery] int tzOffsetMinutes = 0)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try
            {
                DateTime localDay = DateTime.TryParseExact(date, "yyyy-MM-dd",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
                    ? d.Date
                    : DateTime.UtcNow.AddMinutes(tzOffsetMinutes).Date;

                // local midnight -> UTC by subtracting the offset that is ahead of UTC.
                DateTime fromUtc = localDay.AddMinutes(-tzOffsetMinutes);
                DateTime toUtc = fromUtc.AddDays(1);

                var entries = _bl.GetForRange(userId, fromUtc, toUtc);
                int calories = entries.Where(e => e.Kind == "food").Sum(e => e.Calories ?? 0);
                int waterMl = entries.Where(e => e.Kind == "water").Sum(e => e.WaterMl ?? 0);
                return Ok(new { entries, totals = new { calories, waterMl } });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // POST /api/nutrition/user/{userId}  body { kind, name?, calories?, waterMl?, barcode? }
        [HttpPost("user/{userId:int}")]
        public IActionResult Add(int userId, [FromBody] AddNutritionRequest request)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try
            {
                var saved = _bl.Add(new NutritionEntry
                {
                    UserID = userId,
                    Kind = request?.Kind,
                    Name = request?.Name,
                    Calories = request?.Calories,
                    WaterMl = request?.WaterMl,
                    Barcode = request?.Barcode
                });
                return Ok(saved);
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // DELETE /api/nutrition/{entryId}
        [HttpDelete("{entryId:int}")]
        public IActionResult Delete(int entryId)
        {
            var owner = _bl.GetOwnerUserId(entryId);
            if (owner == null) return NotFound("Entry not found");
            if (!CallerMayAct(owner.Value)) return Forbid();
            try
            {
                _bl.Delete(entryId);
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }
    }

    public class AddNutritionRequest
    {
        public string? Kind { get; set; }
        public string? Name { get; set; }
        public int? Calories { get; set; }
        public int? WaterMl { get; set; }
        public string? Barcode { get; set; }
    }
}
