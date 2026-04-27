using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RecommendationController : ControllerBase
    {
        private readonly RecommendationBL _bl = new RecommendationBL();

        [HttpGet("user/{userId}")]
        public ActionResult<List<Recommendation>> GetByUser(int userId)
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
        public IActionResult Create([FromBody] CreateRecommendationRequest request)
        {
            try
            {
                var rec = new Recommendation
                {
                    UserID = request.UserID,
                    Date = request.Date,
                    LoadLevel = request.LoadLevel,
                    RecommendationText = request.RecommendationText,
                    Type = request.Type
                };
                var id = _bl.Create(rec);
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
