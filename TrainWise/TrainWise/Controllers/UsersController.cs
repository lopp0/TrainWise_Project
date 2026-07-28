using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : BaseApiController
    {
        private readonly UserBL _bl;

        public UsersController()
        {
            _bl = new UserBL();
        }

        // Full user list = every user's PII. No screen uses it, and there is no
        // admin role yet, so it is blocked. Re-open behind an admin/role check if
        // an admin console is ever built.
        [HttpGet]
        public IActionResult GetAll()
        {
            return Forbid();
        }

        [HttpGet("{id}")]
        public IActionResult GetById(int id)
        {
            var u = _bl.GetById(id);

            if (u == null)
                return NotFound("User not found");

            return Ok(u);
        }

        [HttpPost]
        [EnableRateLimiting("auth")]
        [AllowAnonymous]
        public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
        {
            try
            {
                // Bot deterrent: verify the reCAPTCHA token before creating the
                // user. No-op (allows) when RECAPTCHA_SECRET isn't configured —
                // see CaptchaVerifier for the test-key vs real-key caveat.
                if (!await CaptchaVerifier.VerifyAsync(request.CaptchaToken))
                    return BadRequest("Invalid CAPTCHA. Please complete the verification and try again.");

                var u = new User
                {
                    FullName = request.FullName,
                    BirthYear = request.BirthYear,
                    Gender = request.Gender,
                    Height = request.Height,
                    Weight = request.Weight,
                    ActivityLevel = request.ActivityLevel,
                    DeviceType = request.DeviceType,
                    UserName = request.UserName,
                    Email = request.Email,
                    Password = request.Password,
                    ExperienceLevel = request.ExperienceLevel,
                    HealthDeclaration = request.HealthDeclaration,
                    ConfirmTerms = request.ConfirmTerms,
                    TermConfirmationDate = request.TermConfirmationDate,
                    IsCoach = request.IsCoach,
                    IsTrainee = request.IsTrainee,

                    // System-controlled — client cannot set these
                    IsBaselineEstablished = false,
                    BaseLineDailyLoad = 0,
                    BaseLineWeeklyLoad = 0,
                    BaselineEstablishedDate = null,
                    ProfileImagePath = null,
                    CreatedAt = DateTime.Now
                };

                int newId = _bl.Create(u);
                u.UserID = newId;
                // Issue a token so the client is authenticated straight after signup.
                var token = JwtService.CreateToken(u);
                return CreatedAtAction(nameof(GetById), new { id = newId }, new { userID = newId, token });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "An unexpected error occurred.");
            }
        }
        [HttpPut("{id}")]
        public IActionResult Update(int id, [FromBody] UpdateUserRequest request)
        {
            if (id != request.UserID)
                return BadRequest("ID mismatch");
            if (!CallerMayAct(id)) return Forbid();

            try
            {
                // Load the existing row so we never accidentally null-out a
                // column that the partial PUT didn't include.
                var existing = _bl.GetById(request.UserID);
                if (existing == null) return NotFound("User not found");

                var u = new User
                {
                    UserID = request.UserID,
                    FullName = request.FullName ?? existing.FullName,
                    BirthYear = request.BirthYear != 0 ? request.BirthYear : existing.BirthYear,
                    Gender = request.Gender ?? existing.Gender,
                    Height = request.Height != 0 ? request.Height : existing.Height,
                    Weight = request.Weight != 0 ? request.Weight : existing.Weight,
                    ActivityLevel = request.ActivityLevel != 0 ? request.ActivityLevel : existing.ActivityLevel,
                    DeviceType = request.DeviceType ?? existing.DeviceType,
                    UserName = request.UserName ?? existing.UserName,
                    Email = request.Email ?? existing.Email,
                    ExperienceLevel = request.ExperienceLevel != 0 ? request.ExperienceLevel : existing.ExperienceLevel,
                    HealthDeclaration = existing.HealthDeclaration,
                    ConfirmTerms = existing.ConfirmTerms,
                    TermConfirmationDate = existing.TermConfirmationDate
                };

                _bl.Update(u);
                return Ok("Updated");
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "An unexpected error occurred.");
            }
        }

        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            if (!CallerMayAct(id)) return Forbid();
            try
            {
                _bl.Delete(id);
                return Ok("Deleted");
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "An unexpected error occurred.");
            }
        }

        [HttpPost("{id}/upload")]
        public async Task<IActionResult> UploadImage(int id, IFormFile file,
            [FromServices] IWebHostEnvironment env)
        {
            if (!CallerMayAct(id)) return Forbid();

            // Validate the upload (size + real image type by magic bytes). The
            // on-disk extension comes from the sniffed type, NOT the client's file
            // name, so a caller can't drop an .html/.svg/.js into wwwroot (which is
            // served publicly) and get stored XSS on the API origin.
            if (!UploadValidator.TryValidateImage(file, out string ext, out string uploadError))
                return BadRequest(uploadError);

            var user = _bl.GetById(id);
            if (user == null)
                return NotFound("User not found");

            string webRoot = env.WebRootPath
               ?? Path.Combine(env.ContentRootPath, "wwwroot");
            string folder = Path.Combine(webRoot, "images");
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);

            // Random component so the public URL can't be enumerated by guessing
            // the timestamp (wwwroot/images is served unauthenticated).
            string fileName = $"{id}_{Guid.NewGuid():N}{ext}";
            string fullPath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            string relativePath = $"images/{fileName}";
            _bl.SetProfileImagePath(id, relativePath);

            return Ok(new { path = "/" + relativePath });
        }

        // A-1: set the user's equipped cosmetics (badge / title / frame).
        [HttpPut("{id}/equip")]
        public IActionResult Equip(int id, [FromBody] EquipRequest request)
        {
            if (!CallerMayAct(id)) return Forbid();
            try
            {
                _bl.UpdateEquipped(id, request.EquippedBadge, request.EquippedTitle, request.EquippedFrame);
                return Ok("Equipped");
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "An unexpected error occurred.");
            }
        }

        // A-1: batch cosmetics lookup. e.g. /api/users/cosmetics?ids=1,2,3
        [HttpGet("cosmetics")]
        public IActionResult GetCosmetics([FromQuery] string ids)
        {
            try
            {
                return Ok(_bl.GetCosmetics(ids));
            }
            catch (Exception)
            {
                return StatusCode(500, "An unexpected error occurred.");
            }
        }

        // Item 12 — register/clear this user's Expo push token for remote push.
        [HttpPut("{id}/pushtoken")]
        public IActionResult SetPushToken(int id, [FromBody] PushTokenRequest request)
        {
            if (!CallerMayAct(id)) return Forbid();
            try
            {
                _bl.SetPushToken(id, request?.Token);
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "An unexpected error occurred.");
            }
        }

        [HttpGet("{id}/summary")]
        public IActionResult GetSummary(int id)
        {
            try
            {
                var summary = _bl.GetSummary(id);
                if (summary == null)
                    return NotFound("User not found");
                return Ok(summary);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "An unexpected error occurred.");
            }
        }

        [HttpPut("{id}/baseline")]
        public IActionResult UpdateBaseline(int id, [FromBody] BaselineRequest request)
        {
            if (!CallerMayAct(id)) return Forbid();
            try
            {
                _bl.UpdateBaseline(id, request.DailyLoad, request.WeeklyLoad);
                return Ok("Baseline updated");
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "An unexpected error occurred.");
            }
        }

        // #131 — GET /api/users/{id}/measurements  → weight/body-fat history
        [HttpGet("{id}/measurements")]
        public IActionResult GetMeasurements(int id)
        {
            if (!CallerMayAct(id)) return Forbid();   // personal health data
            try { return Ok(_bl.GetBodyMeasurements(id)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // #131 — POST /api/users/{id}/measurements  body { weight, bodyFat?, date }
        [HttpPost("{id}/measurements")]
        public IActionResult AddMeasurement(int id, [FromBody] BodyMeasurementRequest request)
        {
            if (!CallerMayAct(id)) return Forbid();
            try
            {
                var newId = _bl.AddBodyMeasurement(id, request.Weight, request.BodyFat,
                    request.Date ?? DateTime.UtcNow);
                return Ok(new { measurementId = newId });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // #111 — change password for a logged-in user (verifies the current one).
        [HttpPut("{id}/password")]
        [EnableRateLimiting("auth")]
        public IActionResult ChangePassword(int id, [FromBody] ChangePasswordRequest request)
        {
            if (!CallerMayAct(id)) return Forbid();
            try
            {
                var ok = _bl.ChangePassword(id, request.CurrentPassword, request.NewPassword);
                if (!ok) return BadRequest("Current password is incorrect.");
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "An unexpected error occurred.");
            }
        }

        [HttpPost("google-login")]
        [EnableRateLimiting("auth")]
        [AllowAnonymous]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
        {
            try
            {
                // The client must send the signed Google ID token. We verify it
                // server-side (signature/expiry/audience via Google's tokeninfo)
                // and derive the identity from the verified token — never trust a
                // raw client-supplied GoogleId (that would be an impersonation hole).
                if (string.IsNullOrWhiteSpace(request.IdToken))
                    return BadRequest("Missing Google ID token.");

                var identity = await GoogleTokenVerifier.VerifyAsync(request.IdToken);
                if (identity == null)
                    return Unauthorized("Invalid or untrusted Google token.");

                // On the SIGN-UP path, refuse if this Google account already exists
                // (steer the user to sign in instead). A password account with the
                // same email is NOT blocked — it has no GoogleId, so it falls through
                // to LoginOrCreateGoogleUser which links Google to it and logs in.
                if (request.IsSignUp && _bl.GetUserByGoogleId(identity.GoogleId) != null)
                    return Conflict("An account with this Google login already exists. Please sign in instead.");

                var user = _bl.LoginOrCreateGoogleUser(identity.GoogleId, identity.Email, identity.FullName);
                if (user == null)
                    return StatusCode(500, "Google login failed");
                var token = JwtService.CreateToken(user);
                return Ok(new { token, user });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "An unexpected error occurred.");
            }
        }

    }

    public class BaselineRequest
    {
        public short DailyLoad { get; set; }
        public short WeeklyLoad { get; set; }
    }

    public class GoogleLoginRequest
    {
        // Preferred: the signed Google ID token, verified server-side.
        public string? IdToken { get; set; }
        // True when called from the Sign-Up screen: block if the Google account
        // already exists. False/omitted (Login screen): log in / link / create.
        public bool IsSignUp { get; set; }
        // All nullable: with [ApiController] + nullable refs ON, a non-nullable
        // string is implicitly [Required] and would 400 the idToken-only payload.
        // GoogleId/Email are derived from the verified token, not the client.
        public string? GoogleId { get; set; }
        public string? Email { get; set; }
        public string? FullName { get; set; }
    }

    public class EquipRequest
    {
        public string? EquippedBadge { get; set; }
        public string? EquippedTitle { get; set; }
        public string? EquippedFrame { get; set; }
    }

    public class PushTokenRequest
    {
        public string? Token { get; set; }
    }

    public class ChangePasswordRequest
    {
        public string? CurrentPassword { get; set; }
        public string? NewPassword { get; set; }
    }

    public class BodyMeasurementRequest
    {
        public double Weight { get; set; }
        public double? BodyFat { get; set; }
        public DateTime? Date { get; set; }
    }

}

