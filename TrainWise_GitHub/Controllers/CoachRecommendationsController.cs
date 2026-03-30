using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    public class CoachRecommendationsController :ControllerBase
    {
        private readonly CoachRecommendationBL _bl = new CoachRecommendationBL();

        [HttpPost]
        public IActionResult Create([FromBody] CoachRecommendation rec)
        {
            try
            {
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
