using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;

namespace TrainWise.Controllers
{
    /// <summary>
    /// "Devices &amp; sessions" (2026-07-19). Lists every device currently logged
    /// into the account and lets the user revoke any of them. Revoking flips
    /// RevokedAt, and the JWT pipeline (Program.cs OnTokenValidated) then refuses
    /// that device's token on its next request, so it is a real remote sign-out
    /// rather than a cosmetic row delete.
    /// </summary>
    [ApiController]
    [Route("api/users/{userId:int}/sessions")]
    public class SessionsController : BaseApiController
    {
        private readonly SessionBL _bl = new SessionBL();

        [HttpGet]
        public IActionResult GetSessions(int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { return Ok(_bl.GetSessions(userId, CallerSessionId)); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        /// <summary>Sign one device out. Revoking your OWN session logs you out here too.</summary>
        [HttpDelete("{sessionId:int}")]
        public IActionResult Revoke(int userId, int sessionId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try
            {
                var ok = _bl.Revoke(userId, sessionId);
                if (!ok) return NotFound("That session is already signed out.");
                return Ok(new { ok = true, wasCurrent = sessionId == CallerSessionId });
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        /// <summary>"Log out everywhere else" — keeps only the calling device.</summary>
        [HttpPost("revoke-others")]
        public IActionResult RevokeOthers(int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try { return Ok(new { revoked = _bl.RevokeOthers(userId, CallerSessionId) }); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}
