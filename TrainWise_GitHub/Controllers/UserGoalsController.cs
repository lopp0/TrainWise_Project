using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/users/{userId}/goals")]
    public class UserGoalsController : ControllerBase
    {
        private readonly UserTrainingGoalBL _bl = new UserTrainingGoalBL();

        [HttpPost("{goalId}")]
        public IActionResult AddGoal(int userId, int goalId)
        {
            try
            {
                _bl.AddGoal(userId, goalId);
                return Ok("Goal added");
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

        [HttpDelete("{goalId}")]
        public IActionResult RemoveGoal(int userId, int goalId)
        {
            try
            {
                _bl.RemoveGoal(userId, goalId);
                return Ok("Goal removed");
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
