using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RecordsController : BaseApiController
    {
        private readonly RecordsBL _bl = new RecordsBL();

        // All personal records + earned badges for a user.
        [HttpGet("{userId:int}")]
        public IActionResult Get(int userId)
        {
            try { return Ok(_bl.Get(userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // #165 — per-activity personal bests (fastest pace, longest distance, etc).
        [HttpGet("{userId:int}/activity-bests")]
        public IActionResult ActivityBests(int userId)
        {
            try { return Ok(_bl.GetActivityBests(userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // Re-evaluate records/badges (call after a workout lands). Returns the
        // full set plus the badge keys newly earned in this call.
        [HttpPost("check/{userId:int}")]
        public IActionResult Check(int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { return Ok(_bl.Check(userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}
