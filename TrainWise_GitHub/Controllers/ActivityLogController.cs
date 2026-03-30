using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ActivityLogController : ControllerBase
    {
        private readonly ActivityLogBL _bl;

        public ActivityLogController()
        {
            _bl = new ActivityLogBL();
        }

        [HttpGet("user/{userId}")]
        public IActionResult GetByUser(int userId)
        {
            try
            {
                var list = _bl.GetByUser(userId);
                return Ok(list);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost]
        public IActionResult Create(ActivityLog log)
        {
            try
            {
                int newId = _bl.Create(log);
                return Ok(new { ActivityID = newId });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut]
        public IActionResult Update(ActivityLog log)
        {
            try
            {
                _bl.Update(log);
                return Ok("Activity updated");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            try
            {
                _bl.Delete(id);
                return Ok("Activity deleted");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }

}

