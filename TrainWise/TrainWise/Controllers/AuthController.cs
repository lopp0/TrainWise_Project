using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("auth")]
    [AllowAnonymous]
    public class AuthController : ControllerBase
    {
        private readonly UserLoginBL _bl = new UserLoginBL();

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            try
            {
                var user = _bl.Login(request.Email, request.Password);
                // Return a signed JWT alongside the user. Response shape is
                // { token, user } — the client reads user.* as before plus token.
                var token = JwtService.CreateToken(user);
                return Ok(new { token, user });
            }
            catch (UnauthorizedAccessException)
            {
                // Same generic message for unknown-email and wrong-password so the
                // endpoint can't be used to enumerate registered accounts.
                return Unauthorized("Invalid email or password");
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                // Don't echo ex.Message — it can carry SQL / internal details.
                return StatusCode(500, "An unexpected error occurred.");
            }
        }
    }

    public class LoginRequest
    {
        public string Email { get; set; }
        public string Password { get; set; }
    }
}

