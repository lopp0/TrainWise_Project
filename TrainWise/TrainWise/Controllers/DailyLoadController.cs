using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DailyLoadController : BaseApiController
    {
        private readonly LoadCalculationBL _loadBl = new LoadCalculationBL();
        private readonly LoadAnalyticsBL _analyticsBl = new LoadAnalyticsBL();

        /// <summary>
        /// Day-by-day load trend for the charts: AC ratio computed with BOTH the
        /// classic rolling method and EWMA on every point, plus a summary block
        /// (monotony/strain, intensity mix). Gated with CallerOwnsOrCoaches so a
        /// linked coach can read a trainee's trend (same rule as workouts).
        /// </summary>
        [HttpGet("user/{userId}/analytics")]
        public ActionResult<LoadAnalytics> GetAnalytics(
            int userId, [FromQuery] int days = 56, [FromQuery] DateTime? end = null)
        {
            if (!CallerOwnsOrCoaches(userId)) return Forbid();
            try
            {
                return Ok(_analyticsBl.GetAnalytics(userId, days, end));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "Could not compute load analytics.");
            }
        }

        [HttpGet("user/{userId}")]
        public ActionResult<List<DailyLoad>> GetByUser(int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try
            {
                return Ok(_loadBl.GetByUser(userId));
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

        [HttpPost("user/{userId}/calculate")]
        public ActionResult CalculateAndSave(int userId, [FromBody] DateRequest request)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try
            {
                var result = _loadBl.CalculateAndSave(userId, request.Date);
                return Ok(result);
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

    public class DateRequest
    {
        public DateTime Date { get; set; }
    }
}