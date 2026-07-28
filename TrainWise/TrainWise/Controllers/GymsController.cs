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

        // #146 — GET /api/gyms/nearby?lat=&lng=&radiusKm=
        // Seeded gyms merged with live Google Places results (server-side key).
        // Falls back to seeded-only when the Places key isn't configured.
        [HttpGet("nearby")]
        public IActionResult GetNearby([FromQuery] double lat, [FromQuery] double lng, [FromQuery] double radiusKm = 25)
        {
            try { return Ok(_bl.GetNearbyMerged(lat, lng, radiusKm)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // #146 diagnostics — GET /api/gyms/places-debug?lat=&lng=&radiusKm=
        // Shows whether the server-side Places key is set and what Google returned
        // ("OK" / "REQUEST_DENIED" / "ZERO_RESULTS" + error_message). Use this to
        // confirm the GOOGLE_PLACES_KEY env var + Places API enablement.
        [HttpGet("places-debug")]
        public IActionResult PlacesDebug([FromQuery] double lat = 32.3215, [FromQuery] double lng = 34.8532, [FromQuery] double radiusKm = 25)
        {
            var places = PlacesService.GetNearbyGyms(lat, lng, radiusKm);
            return Ok(new
            {
                keyConfigured = PlacesService.Enabled,
                googleStatus = PlacesService.LastStatus,
                googleError = PlacesService.LastError,
                placesCount = places.Count,
                sample = places.Take(3).Select(g => new { g.Name, g.Latitude, g.Longitude })
            });
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
