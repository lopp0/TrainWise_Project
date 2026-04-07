using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ActivityTypeController : ControllerBase
    {
        private readonly ActivityTypeBL _bl = new ActivityTypeBL();

        [HttpGet]
        public IActionResult GetAll()
        {
            try
            {
                return Ok(_bl.GetAll());
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}
