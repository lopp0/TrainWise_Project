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
        public IActionResult Create([FromBody] CreateActivityLogRequest request)
        {
            try
            {
                var log = new ActivityLog
                {
                    UserID = request.UserID,
                    ActivityTypeID = request.ActivityTypeID,
                    StartTime = request.StartTime,
                    EndTime = request.EndTime,
                    DistanceKM = request.DistanceKM,
                    AvgHeartRate = request.AvgHeartRate,
                    MaxHeartRate = request.MaxHeartRate,
                    CaloriesBurned = request.CaloriesBurned,
                    SourceDevice = request.SourceDevice,
                    ExertionLevel = request.ExertionLevel,
                    Duration = request.Duration,
                    IsConfirmed = request.IsConfirmed
                };

                int newId = _bl.Create(log);
                return Ok(new { ActivityID = newId });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut]
        public IActionResult Update([FromBody] UpdateActivityLogRequest request)
        {
            try
            {
                var log = new ActivityLog
                {
                    ActivityID = request.ActivityID,
                    ActivityTypeID = request.ActivityTypeID,
                    StartTime = request.StartTime,
                    EndTime = request.EndTime,
                    DistanceKM = request.DistanceKM,
                    AvgHeartRate = request.AvgHeartRate,
                    MaxHeartRate = request.MaxHeartRate,
                    CaloriesBurned = request.CaloriesBurned,
                    SourceDevice = request.SourceDevice,
                    ExertionLevel = request.ExertionLevel,
                    Duration = request.Duration,
                    IsConfirmed = request.IsConfirmed
                };
                _bl.Update(log);
                return Ok("Activity updated");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id}")]
        public IActionResult SoftDelete(int id)
        {
            try
            {
                _bl.Delete(id);
                return Ok("Activity hidden");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }

}

