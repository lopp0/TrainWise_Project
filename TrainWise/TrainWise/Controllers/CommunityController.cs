using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    // Community medium batch: #142 friend challenges, #145 group events,
    // #169 coach marketplace/reviews, #144 activity feed. Three-layer, gated
    // through BaseApiController (tokenless allowed, mismatched token denied).
    [ApiController]
    [Route("api/community")]
    public class CommunityController : BaseApiController
    {
        private readonly CommunityBL _bl = new CommunityBL();

        // ── #142 Challenges ──────────────────────────────────────────────
        [HttpPost("challenges")]
        public IActionResult CreateChallenge([FromBody] CreateChallengeRequest req)
        {
            if (req == null) return BadRequest("Body required");
            if (!CallerMayAct(req.CreatorID)) return Forbid();
            try { return Ok(new { challengeId = _bl.CreateChallenge(req) }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpGet("challenges/user/{userId:int}")]
        public IActionResult GetChallenges(int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { return Ok(_bl.GetChallengesForUser(userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpGet("challenges/{challengeId:int}/standings")]
        public IActionResult GetStandings(int challengeId)
        {
            try { return Ok(_bl.GetChallengeStandings(challengeId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // Pending invitations for the user.
        [HttpGet("challenges/invites/{userId:int}")]
        public IActionResult GetInvites(int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { return Ok(_bl.GetChallengeInvites(userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // Accept (accept=true) or decline an invitation.
        [HttpPut("challenges/{challengeId:int}/invite/{userId:int}/{accept:bool}")]
        public IActionResult RespondInvite(int challengeId, int userId, bool accept)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { _bl.RespondChallengeInvite(challengeId, userId, accept); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpPost("challenges/{challengeId:int}/join/{userId:int}")]
        public IActionResult JoinChallenge(int challengeId, int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { _bl.JoinChallenge(challengeId, userId); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpDelete("challenges/{challengeId:int}/leave/{userId:int}")]
        public IActionResult LeaveChallenge(int challengeId, int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { _bl.LeaveChallenge(challengeId, userId); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // ── #145 Events ──────────────────────────────────────────────────
        [HttpPost("events")]
        public IActionResult CreateEvent([FromBody] CreateEventRequest req)
        {
            if (req == null) return BadRequest("Body required");
            if (!CallerMayAct(req.CreatorID)) return Forbid();
            try { return Ok(new { eventId = _bl.CreateEvent(req) }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpGet("events/user/{userId:int}")]
        public IActionResult GetEvents(int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { return Ok(_bl.GetEventsForUser(userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpGet("events/{eventId:int}/attendees")]
        public IActionResult GetAttendees(int eventId)
        {
            try { return Ok(_bl.GetEventAttendees(eventId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // #145 group chat — GET messages (gated to attendees) + POST a message.
        [HttpGet("events/{eventId:int}/messages")]
        public IActionResult GetEventMessages(int eventId, [FromQuery] int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { return Ok(_bl.GetEventMessages(eventId, userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpPost("events/{eventId:int}/messages")]
        public IActionResult PostEventMessage(int eventId, [FromBody] PostEventMessageRequest req)
        {
            if (req == null) return BadRequest("Body required");
            if (!CallerMayAct(req.SenderId)) return Forbid();
            // Returns the SAVED message (not just an id) so the client can append
            // it straight away, same as the 1:1 chat.
            try { return Ok(_bl.PostEventMessage(eventId, req.SenderId, req.Text, req.ImagePath, req.VideoPath, req.AudioPath)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // #7 — emoji reactions on group-chat messages (toggle) + fetch them all.
        [HttpPost("events/{eventId:int}/messages/{messageId:int}/react")]
        public IActionResult ReactEventMessage(int eventId, int messageId, [FromBody] ReactEventMessageRequest req)
        {
            if (req == null) return BadRequest("Body required");
            if (!CallerMayAct(req.UserId)) return Forbid();
            try { _bl.ReactEventMessage(eventId, messageId, req.UserId, req.Emoji); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpGet("events/{eventId:int}/reactions")]
        public IActionResult GetEventReactions(int eventId, [FromQuery] int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { return Ok(_bl.GetEventReactions(eventId, userId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpPut("events/{eventId:int}/rsvp")]
        public IActionResult Rsvp(int eventId, [FromBody] RsvpRequest req)
        {
            if (req == null) return BadRequest("Body required");
            if (!CallerMayAct(req.UserID)) return Forbid();
            try { _bl.RsvpEvent(eventId, req.UserID, req.Status); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpDelete("events/{eventId:int}")]
        public IActionResult DeleteEvent(int eventId, [FromQuery] int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try
            {
                var n = _bl.DeleteEvent(eventId, userId);
                if (n == 0) return BadRequest("Not found or not your event");
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // ── #169 Coach marketplace + reviews ─────────────────────────────
        [HttpGet("coaches")]
        public IActionResult GetMarketplace([FromQuery] int viewerId, [FromQuery] string search = null, [FromQuery] string sort = "rating")
        {
            if (!CallerMayAct(viewerId)) return Forbid();
            try { return Ok(_bl.GetCoachMarketplace(viewerId, search, sort)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpGet("coaches/{coachUserId:int}/reviews")]
        public IActionResult GetReviews(int coachUserId)
        {
            try { return Ok(_bl.GetCoachReviews(coachUserId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpPost("coaches/{coachUserId:int}/reviews")]
        public IActionResult UpsertReview(int coachUserId, [FromBody] UpsertReviewRequest req)
        {
            if (req == null) return BadRequest("Body required");
            if (!CallerMayAct(req.ReviewerUserID)) return Forbid();
            try { _bl.UpsertCoachReview(coachUserId, req.ReviewerUserID, req.Rating, req.Text); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // ── #144 Activity feed ───────────────────────────────────────────
        [HttpGet("feed/{userId:int}")]
        public IActionResult GetFeed(int userId, [FromQuery] int limit = 40)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { return Ok(_bl.GetActivityFeed(userId, limit)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}
