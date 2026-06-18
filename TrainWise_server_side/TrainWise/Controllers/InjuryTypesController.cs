using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InjuryTypesController : ControllerBase
    {
        private readonly InjuryTypeBL _bl = new InjuryTypeBL();

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
