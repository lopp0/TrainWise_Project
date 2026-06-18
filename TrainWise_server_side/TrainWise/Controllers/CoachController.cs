using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CoachController :ControllerBase
    {
        private readonly CoachBL _bl = new CoachBL();

        [HttpGet("by-user/{userId}")]
        public IActionResult GetCoachByUser(int userId)
        {
            try
            {
                return Ok(_bl.GetCoachByUserId(userId));
            }
            catch (ArgumentException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("{coachId}/trainees")]
        public IActionResult GetTrainees(int coachId)
        {
            try
            {
                return Ok(_bl.GetTrainees(coachId));
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

        [HttpGet("{coachId}/trainees/{userId}/load")]
        public IActionResult GetTraineeLoad(int coachId, int userId)
        {
            try
            {
                return Ok(_bl.GetTraineeLoad(coachId, userId));
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

        // GET /api/coach/for-trainee/{userId} — coaches this trainee is linked to
        // (so the trainee can open a chat with their coach).
        [HttpGet("for-trainee/{userId}")]
        public IActionResult GetCoachesForTrainee(int userId)
        {
            try
            {
                return Ok(_bl.GetCoachesForTrainee(userId));
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
