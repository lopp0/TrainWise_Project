using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InjuryReportController : ControllerBase
    {
        private readonly InjuryReportBL _bl = new InjuryReportBL();

        [HttpGet("user/{userId}")]
        public ActionResult<List<InjuryReport>> GetByUser(int userId)
        {
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

        [HttpPost]
        public IActionResult Create([FromBody] CreateInjuryReportRequest request)
        {
            try
            {
                var report = new InjuryReport
                {
                    UserID = request.UserID,
                    InjuryTypeID = request.InjuryTypeID,
                    Date = request.Date,
                    Severity = request.Severity,
                    Notes = request.Notes
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
}
