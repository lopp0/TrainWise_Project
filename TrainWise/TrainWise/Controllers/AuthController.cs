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
        private readonly AuthRecoveryBL _recovery = new AuthRecoveryBL();
        private readonly SessionBL _sessions = new SessionBL();

        // #110 — request a password-reset code. NEVER reveals whether the email
        // exists (same response either way). In dev (AUTH_DEV_CODES=true) the code
        // is returned so the flow is testable without an email provider.
        [HttpPost("forgot")]
        public IActionResult Forgot([FromBody] ForgotRequest request)
        {
            try
            {
                var code = _recovery.RequestPasswordReset(request?.Email);
                var body = new Dictionary<string, object> { { "message", "If that email exists, a reset code was sent." } };
                if (code != null && AuthRecoveryBL.DevCodesEnabled) body["devCode"] = code;
                return Ok(body);
            }
            catch (Exception) { return Ok(new { message = "If that email exists, a reset code was sent." }); }
        }

        // #110 — reset the password with the emailed code.
        [HttpPost("reset")]
        public IActionResult Reset([FromBody] ResetRequest request)
        {
            try
            {
                _recovery.ConfirmPasswordReset(request?.Email, request?.Code, request?.NewPassword);
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // #114 — request an email-verification code for a user.
        [HttpPost("verify/request")]
        public IActionResult VerifyRequest([FromBody] VerifyRequestBody request)
        {
            try
            {
                var code = _recovery.RequestEmailVerification(request?.UserId ?? 0);
                var body = new Dictionary<string, object> { { "ok", true } };
                if (AuthRecoveryBL.DevCodesEnabled) body["devCode"] = code;
                return Ok(body);
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // #114 — confirm the email with the code (flips Users.EmailVerified).
        [HttpPost("verify/confirm")]
        public IActionResult VerifyConfirm([FromBody] VerifyConfirmBody request)
        {
            try
            {
                _recovery.ConfirmEmailVerification(request?.UserId ?? 0, request?.Code);
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            try
            {
                var user = _bl.Login(request.Email, request.Password);
                // 2026-07-19 — register this login as a revocable SESSION and bake
                // its id into the token ("sid"), so the user can later kill this
                // device from Settings → Devices & sessions and the token dies with
                // it. Session creation is best-effort: a failure here must never
                // block a legitimate login, it just yields a non-revocable token.
                int sessionId = 0;
                var tokenId = Guid.NewGuid().ToString("N");
                try
                {
                    sessionId = _sessions.CreateSession(
                        user.UserID, tokenId,
                        request?.DeviceName, request?.Platform, request?.AppVersion,
                        HttpContext?.Connection?.RemoteIpAddress?.ToString());
                }
                catch (Exception ex) { Console.WriteLine($"[Auth] session create failed: {ex.Message}"); }

                var token = JwtService.CreateToken(user, sessionId, tokenId);
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
        // Optional device metadata for the Devices & sessions list. MUST be
        // nullable (nullable-refs are ON) or older clients that omit them 400.
        public string? DeviceName { get; set; }
        public string? Platform { get; set; }
        public string? AppVersion { get; set; }
    }

    public class ForgotRequest { public string Email { get; set; } }
    public class ResetRequest
    {
        public string Email { get; set; }
        public string Code { get; set; }
        public string NewPassword { get; set; }
    }
    public class VerifyRequestBody { public int UserId { get; set; } }
    public class VerifyConfirmBody { public int UserId { get; set; } public string Code { get; set; } }
}

