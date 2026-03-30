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

        [HttpPost]
        public IActionResult Create([FromBody] InjuryReport report)
        {
            try
            {
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
