using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/users/{userId}/activity-preferences")]
    public class UserActivityPreferencesController : BaseApiController
    {
        private readonly UserActivityPreferenceBL _bl = new UserActivityPreferenceBL();

        [HttpPost("{activityTypeId}")]
        public IActionResult AddPreference(int userId, int activityTypeId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try
            {
                _bl.AddPreference(userId, activityTypeId);
                return Ok("Preference added");
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

        [HttpDelete("{activityTypeId}")]
        public IActionResult RemovePreference(int userId, int activityTypeId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try
            {
                _bl.RemovePreference(userId, activityTypeId);
                return Ok("Preference removed");
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
