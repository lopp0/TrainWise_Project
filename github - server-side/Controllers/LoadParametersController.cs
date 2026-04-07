using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LoadParametersController : ControllerBase
    {
        private readonly LoadParametersBL _bl = new LoadParametersBL();

        [HttpGet]
        public IActionResult GetParameters()
        {
            try
            {
                return Ok(_bl.GetParameters());
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}
