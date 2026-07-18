using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TrainingGoalsController : ControllerBase
    {
        private readonly TrainingGoalCatalogBL _bl = new TrainingGoalCatalogBL();

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
