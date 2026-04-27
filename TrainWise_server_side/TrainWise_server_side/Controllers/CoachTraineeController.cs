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