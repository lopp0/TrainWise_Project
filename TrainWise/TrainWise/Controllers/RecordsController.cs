using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RecordsController : ControllerBase
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

        // Re-evaluate records/badges (call after a workout lands). Returns the
        // full set plus the badge keys newly earned in this call.
        [HttpPost("check/{userId:int}")]
        public IActionResult Check(int userId)
        {
            try { return Ok(_bl.Check(userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}
