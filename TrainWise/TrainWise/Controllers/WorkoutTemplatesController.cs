using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    // #119 — reusable workout templates / favorites.
    [ApiController]
    [Route("api/[controller]")]
    public class WorkoutTemplatesController : BaseApiController
    {
        private readonly WorkoutTemplateBL _bl = new WorkoutTemplateBL();

        // GET /api/workouttemplates/user/{userId}
        [HttpGet("user/{userId:int}")]
        public IActionResult GetByUser(int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { return Ok(_bl.GetByUser(userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // POST /api/workouttemplates  body { userID, name, activityTypeID, duration, exertionLevel, targetValue? }
        [HttpPost]
        public IActionResult Create([FromBody] WorkoutTemplateRequest request)
        {
            if (request == null) return BadRequest("Body is required");
            if (!CallerMayAct(request.UserID)) return Forbid();
            try
            {
                var saved = _bl.Create(new WorkoutTemplate
                {
                    UserID = request.UserID,
                    Name = request.Name,
                    ActivityTypeID = request.ActivityTypeID,
                    Duration = request.Duration,
                    ExertionLevel = request.ExertionLevel,
                    TargetValue = request.TargetValue
                });
                return Ok(saved);
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // DELETE /api/workouttemplates/{templateId}
        [HttpDelete("{templateId:int}")]
        public IActionResult Delete(int templateId)
        {
            var owner = _bl.GetOwnerUserId(templateId);
            if (owner == null) return NotFound("Template not found");
            if (!CallerMayAct(owner.Value)) return Forbid();
            try
            {
                _bl.Delete(templateId);
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }
    }

    public class WorkoutTemplateRequest
    {
        public int UserID { get; set; }
        public string? Name { get; set; }
        public int ActivityTypeID { get; set; }
        public int Duration { get; set; }
        public byte ExertionLevel { get; set; }
        public double? TargetValue { get; set; }
    }
}
