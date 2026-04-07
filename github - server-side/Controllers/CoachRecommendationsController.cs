using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CoachRecommendationsController :ControllerBase
    {
        private readonly CoachRecommendationBL _bl = new CoachRecommendationBL();
        
        [HttpPost]
        public IActionResult Create([FromBody] CreateCoachRecommendationRequest request)
        {
            try
            {
                var rec = new CoachRecommendation
                {
                    CoachID = request.CoachID,
                    UserID = request.UserID,
                    Date = request.Date,
                    Title = request.Title,
                    Text = request.Text
                };
                int id = _bl.Create(rec);
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

        [HttpGet("user/{userId}")]
        public IActionResult GetByUser(int userId)
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
    }
}
