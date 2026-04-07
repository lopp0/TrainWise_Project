using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DailyLoadController : ControllerBase
    {
        private readonly LoadCalculationBL _loadBl = new LoadCalculationBL();

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

        [HttpPost("user/{userId}/calculate")]
        public ActionResult CalculateAndSave(int userId, [FromBody] DateRequest request)
        {
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