using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SocialController : ControllerBase
    {
        private readonly SocialBL _bl = new SocialBL();

        // ── presence / location ──────────────────────────────────────────
        // PUT /api/social/presence/{userId} — heartbeat (marks user online).
        [HttpPut("presence/{userId}")]
        public IActionResult Heartbeat(int userId)
        {
            try { _bl.UpdateLastSeen(userId); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // PUT /api/social/location/{userId}  body { latitude, longitude }
        [HttpPut("location/{userId}")]
        public IActionResult UpdateLocation(int userId, [FromBody] UpdateLocationRequest body)
        {
            try
            {
                if (body == null) return BadRequest("Body required");
                _bl.UpdateLocation(userId, body.Latitude, body.Longitude);
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // ── nearby / profile ─────────────────────────────────────────────
        // GET /api/social/nearby/{userId}?lat=&lng=&radiusKm=
        [HttpGet("nearby/{userId}")]
        public IActionResult GetNearby(int userId, [FromQuery] double lat, [FromQuery] double lng, [FromQuery] double radiusKm = 25)
        {
            try { return Ok(_bl.GetNearbyUsers(userId, lat, lng, radiusKm)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/social/profile/{viewerId}/{targetId}
        [HttpGet("profile/{viewerId}/{targetId}")]
        public IActionResult GetMiniProfile(int viewerId, int targetId)
        {
            try { return Ok(_bl.GetUserMiniProfile(viewerId, targetId)); }
            catch (ArgumentException ex) { return NotFound(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // ── friendships ──────────────────────────────────────────────────
        // POST /api/social/friends/request/{requesterId}/{addresseeId}
        [HttpPost("friends/request/{requesterId}/{addresseeId}")]
        public IActionResult SendFriendRequest(int requesterId, int addresseeId)
        {
            try { return Ok(_bl.SendFriendRequest(requesterId, addresseeId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // PUT /api/social/friends/respond/{friendshipId}/{accept}
        [HttpPut("friends/respond/{friendshipId}/{accept}")]
        public IActionResult RespondFriendRequest(int friendshipId, bool accept)
        {
            try { return Ok(_bl.RespondFriendRequest(friendshipId, accept)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/social/friends/{userId} — accepted friends
        [HttpGet("friends/{userId}")]
        public IActionResult GetFriends(int userId)
        {
            try { return Ok(_bl.GetFriends(userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/social/friends/requests/{userId} — incoming pending
        [HttpGet("friends/requests/{userId}")]
        public IActionResult GetPendingRequests(int userId)
        {
            try { return Ok(_bl.GetPendingFriendRequests(userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // DELETE /api/social/friends/{userA}/{userB}
        [HttpDelete("friends/{userA}/{userB}")]
        public IActionResult RemoveFriend(int userA, int userB)
        {
            try { _bl.RemoveFriend(userA, userB); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // ── coach offers ─────────────────────────────────────────────────
        // POST /api/social/coachoffer/{coachUserId}/{traineeUserId}
        [HttpPost("coachoffer/{coachUserId}/{traineeUserId}")]
        public IActionResult SendCoachOffer(int coachUserId, int traineeUserId)
        {
            try { return Ok(_bl.SendCoachOffer(coachUserId, traineeUserId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // PUT /api/social/coachoffer/respond/{offerId}/{accept}
        [HttpPut("coachoffer/respond/{offerId}/{accept}")]
        public IActionResult RespondCoachOffer(int offerId, bool accept)
        {
            try { return Ok(_bl.RespondCoachOffer(offerId, accept)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/social/coachoffer/trainee/{traineeUserId} — pending offers
        [HttpGet("coachoffer/trainee/{traineeUserId}")]
        public IActionResult GetCoachOffersForTrainee(int traineeUserId)
        {
            try { return Ok(_bl.GetCoachOffersForTrainee(traineeUserId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/social/coachoffer/sent/{coachUserId}
        [HttpGet("coachoffer/sent/{coachUserId}")]
        public IActionResult GetSentCoachOffers(int coachUserId)
        {
            try { return Ok(_bl.GetSentCoachOffers(coachUserId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}
