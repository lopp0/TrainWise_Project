using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DailyLoadController : ControllerBase
    {
        private readonly DailyLoadBL _loadBl = new DailyLoadBL();
        private readonly RecommendationBL _recBl = new RecommendationBL();

        [HttpGet("user/{userId}")]
        public ActionResult<List<DailyLoad>> GetByUser(int userId)
        {
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

        [HttpGet("user/{userId}/date/{date}")]
        public ActionResult CalculateForDay(int userId, DateTime date)
        {
            try
            {
                var result = _loadBl.CalculateForDay(userId, date);
                return Ok(new
                {
                    AcuteLoad = result.acute,
                    ChronicLoad = result.chronic,
                    ACRatio = result.acRatio,
                    StressScore = result.stressScore,
                    LoadLevel = result.loadLevel
                });
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

        [HttpGet("user/{userId}/recommendations")]
        public ActionResult<List<Recommendation>> GetRecommendations(int userId)
        {
            try
            {
                return Ok(_recBl.GetByUser(userId));
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

        [HttpPost("recommendations")]
        public IActionResult CreateRecommendation([FromBody] Recommendation rec)
        {
            try
            {
                var id = _recBl.Create(rec);
                rec.RecID = id;
                return Ok(rec);
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
