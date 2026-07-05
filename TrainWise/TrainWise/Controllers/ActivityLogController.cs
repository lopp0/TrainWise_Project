using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ActivityLogController : BaseApiController
    {
        private readonly ActivityLogBL _bl;

        public ActivityLogController()
        {
            _bl = new ActivityLogBL();
        }

        [HttpGet("user/{userId}")]
        public IActionResult GetByUser(int userId)
        {
            if (!CallerOwnsOrCoaches(userId)) return Forbid();   // self or their linked coach
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
            // You can only log a workout for yourself.
            if (!CallerMayAct(request.UserID)) return Forbid();
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
            var owner = _bl.GetOwnerUserId(request.ActivityID);
            if (owner == null) return NotFound("Workout not found");
            if (!CallerMayAct(owner.Value)) return Forbid();   // edit only your own workout
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

        // #124 — GET /api/activitylog/{id}/notes  → { notes, photoPath }
        [HttpGet("{id:int}/notes")]
        public IActionResult GetNotes(int id)
        {
            var owner = _bl.GetOwnerUserId(id);
            if (owner == null) return NotFound("Workout not found");
            if (!CallerOwnsOrCoaches(owner.Value)) return Forbid();   // self or their coach may view
            try
            {
                var (notes, photoPath) = _bl.GetNotesAndPhoto(id);
                return Ok(new { notes, photoPath });
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // #124 — PUT /api/activitylog/{id}/notes  body { notes, photoPath }
        [HttpPut("{id:int}/notes")]
        public IActionResult SetNotes(int id, [FromBody] WorkoutNotesRequest request)
        {
            var owner = _bl.GetOwnerUserId(id);
            if (owner == null) return NotFound("Workout not found");
            if (!CallerMayAct(owner.Value)) return Forbid();
            try
            {
                _bl.SetNotesAndPhoto(id, request?.Notes, request?.PhotoPath);
                return Ok(new { ok = true });
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("{id}")]
        public IActionResult SoftDelete(int id)
        {
            var owner = _bl.GetOwnerUserId(id);
            if (owner == null) return NotFound("Workout not found");
            if (!CallerMayAct(owner.Value)) return Forbid();
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

    public class WorkoutNotesRequest
    {
        public string? Notes { get; set; }
        public string? PhotoPath { get; set; }
    }

}

