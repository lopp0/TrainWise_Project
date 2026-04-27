using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserLoginBL _bl = new UserLoginBL();

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            try
            {
                var user = _bl.Login(request.Email, request.Password);
                return Ok(user);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(ex.Message);
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

    public class LoginRequest
    {
        public string Email { get; set; }
        public string Password { get; set; }
    }
}

