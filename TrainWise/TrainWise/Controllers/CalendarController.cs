using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/calendar")]
    public class CalendarController : ControllerBase
    {
        private readonly CalendarBL _bl = new CalendarBL();

        // GET /api/calendar/{userId}?from=YYYY-MM-DD&to=YYYY-MM-DD
        [HttpGet("{userId:int}")]
        public IActionResult Get(int userId, [FromQuery] DateTime from, [FromQuery] DateTime to)
        {
            try
            {
                if (from == default) from = DateTime.Today.AddDays(-7);
                if (to == default) to = DateTime.Today.AddDays(28);
                return Ok(_bl.GetRange(userId, from, to));
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // POST /api/calendar/{userId}
        [HttpPost("{userId:int}")]
        public IActionResult Create(int userId, [FromBody] PlannedWorkoutRequest body)
        {
            try
            {
                var p = ToPlan(body);
                p.UserID = userId;
                return Ok(new { planId = _bl.Create(p) });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // PUT /api/calendar/{planId}
        [HttpPut("{planId:int}")]
        public IActionResult Update(int planId, [FromBody] PlannedWorkoutRequest body)
        {
            try
            {
                var p = ToPlan(body);
                p.PlanId = planId;
                _bl.Update(p);
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // DELETE /api/calendar/{planId}
        [HttpDelete("{planId:int}")]
        public IActionResult Delete(int planId)
        {
            try { _bl.Delete(planId); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // PUT /api/calendar/{planId}/complete?linkedLogId=
        [HttpPut("{planId:int}/complete")]
        public IActionResult Complete(int planId, [FromQuery] int? linkedLogId)
        {
            try { _bl.MarkComplete(planId, linkedLogId); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        private static PlannedWorkout ToPlan(PlannedWorkoutRequest b)
        {
            DateTime.TryParse(b.PlannedDate, out var d);
            if (d == default) d = DateTime.Today;
            return new PlannedWorkout
            {
                CreatedByCoach = b.CreatedByCoach,
                ActivityTypeId = b.ActivityTypeId,
                PlannedDate = d,
                PlannedDuration = b.PlannedDuration,
                PlannedDistance = b.PlannedDistance,
                PlannedLoad = b.PlannedLoad,
                Notes = b.Notes,
            };
        }
    }
}
