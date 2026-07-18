using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InjuryReportController : BaseApiController
    {
        private readonly InjuryReportBL _bl = new InjuryReportBL();

        [HttpGet("user/{userId}")]
        public ActionResult<List<InjuryReport>> GetByUser(int userId)
        {
            if (!CallerOwnsOrCoaches(userId)) return Forbid();
            try
            {
                return Ok(_bl.GetByUser(userId));
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

        [HttpGet("user/{userId}/active")]
        public ActionResult<List<InjuryReport>> GetActiveByUser(int userId)
        {
            if (!CallerOwnsOrCoaches(userId)) return Forbid();
            try
            {
                return Ok(_bl.GetActiveByUser(userId));
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

        [HttpPut("{injuryId:int}/recover")]
        public IActionResult MarkRecovered([FromRoute] int injuryId)
        {
            var owner = _bl.GetOwnerUserId(injuryId);
            if (owner == null) return NotFound("Injury not found");
            if (!CallerMayAct(owner.Value)) return Forbid();
            try
            {
                _bl.MarkRecovered(injuryId);
                return Ok(new { injuryId, status = "recovered" });
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

        // #127 — GET /api/injuryreport/{injuryId}/pain  → pain-level history
        [HttpGet("{injuryId:int}/pain")]
        public IActionResult GetPainLogs(int injuryId)
        {
            var owner = _bl.GetOwnerUserId(injuryId);
            if (owner == null) return NotFound("Injury not found");
            if (!CallerOwnsOrCoaches(owner.Value)) return Forbid();
            try { return Ok(_bl.GetPainLogs(injuryId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // #127 — POST /api/injuryreport/{injuryId}/pain  body { level, note }
        [HttpPost("{injuryId:int}/pain")]
        public IActionResult AddPainLog(int injuryId, [FromBody] PainLogRequest request)
        {
            var owner = _bl.GetOwnerUserId(injuryId);
            if (owner == null) return NotFound("Injury not found");
            if (!CallerMayAct(owner.Value)) return Forbid();
            try
            {
                var id = _bl.AddPainLog(injuryId, request.Level, request.Note);
                return Ok(new { painLogId = id });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpPost]
        public IActionResult Create([FromBody] CreateInjuryReportRequest request)
        {
            if (!CallerMayAct(request.UserID)) return Forbid();
            try
            {
                var report = new InjuryReport
                {
                    UserID = request.UserID,
                    InjuryTypeID = request.InjuryTypeID,
                    Date = request.Date,
                    Severity = request.Severity,
                    Notes = request.Notes,
                    LinkedActivityLogID = request.LinkedActivityLogID
                };
                var id = _bl.Create(report);
                report.InjuryID = id;
                return Ok(report);
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

    public class PainLogRequest
    {
        public int Level { get; set; }
        public string? Note { get; set; }
    }
}
