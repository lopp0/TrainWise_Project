using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GymsController : ControllerBase
    {
        private readonly GymBL _bl = new GymBL();

        // GET /api/gyms?lat=&lng=&radiusKm=
        [HttpGet]
        public IActionResult GetGyms([FromQuery] double lat, [FromQuery] double lng, [FromQuery] double radiusKm = 25)
        {
            try { return Ok(_bl.GetGyms(lat, lng, radiusKm)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/gyms/{gymId}/coaches — recommended coaches at a gym
        [HttpGet("{gymId}/coaches")]
        public IActionResult GetGymCoaches(int gymId)
        {
            try { return Ok(_bl.GetGymCoaches(gymId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // POST /api/gyms/{gymId}/coaches/{coachUserId} — coach lists self here
        [HttpPost("{gymId}/coaches/{coachUserId}")]
        public IActionResult AddCoach(int gymId, int coachUserId)
        {
            try { _bl.AddCoachToGym(gymId, coachUserId); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // DELETE /api/gyms/{gymId}/coaches/{coachUserId} — coach removes self
        [HttpDelete("{gymId}/coaches/{coachUserId}")]
        public IActionResult RemoveCoach(int gymId, int coachUserId)
        {
            try { _bl.RemoveCoachFromGym(gymId, coachUserId); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/gyms/for-coach/{coachUserId} — gyms a coach is recommended at
        [HttpGet("for-coach/{coachUserId}")]
        public IActionResult GetGymsForCoach(int coachUserId)
        {
            try { return Ok(_bl.GetGymsForCoach(coachUserId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}
