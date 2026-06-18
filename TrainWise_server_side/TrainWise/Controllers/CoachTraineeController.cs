using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CoachTraineeController : ControllerBase
    {
        private readonly CoachTraineeBL _bl = new CoachTraineeBL();

        [HttpPost("{coachId}/connect/{userId}")]
        public IActionResult Connect(int coachId, int userId)
        {
            try
            {
                _bl.Connect(coachId, userId);
                return Ok("Connected to coach");
            }
            catch (InvalidOperationException ex)
            {
                // Pair already exists — 409 so the app shows "already connected"
                // rather than a generic failure.
                return Conflict(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpDelete("{coachId}/disconnect/{userId}")]
        public IActionResult Disconnect(int coachId, int userId)
        {
            try
            {
                _bl.Disconnect(coachId, userId);
                return Ok("Disconnected from coach");
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}