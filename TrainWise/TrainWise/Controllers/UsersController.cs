using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly UserBL _bl;

        public UsersController()
        {
            _bl = new UserBL();
        }

        [HttpGet]
        public IActionResult GetAll()
        {
            return Ok(_bl.GetAll());
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
        public IActionResult Create([FromBody] CreateUserRequest request)
        {
            try
            {
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
                return CreatedAtAction(nameof(GetById), new { id = newId }, new { userID = newId });
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
        [HttpPut("{id}")]
        public IActionResult Update(int id, [FromBody] UpdateUserRequest request)
        {
            if (id != request.UserID)
                return BadRequest("ID mismatch");

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
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            try
            {
                _bl.Delete(id);
                return Ok("Deleted");
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

        [HttpPost("{id}/upload")]
        public async Task<IActionResult> UploadImage(int id, IFormFile file,
            [FromServices] IWebHostEnvironment env)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            var user = _bl.GetById(id);
            if (user == null)
                return NotFound("User not found");

            string webRoot = env.WebRootPath
               ?? Path.Combine(env.ContentRootPath, "wwwroot");
            string folder = Path.Combine(webRoot, "images");
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);

            string ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
            string fileName = $"{id}_{DateTime.UtcNow.Ticks}{ext}";
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
            try
            {
                _bl.UpdateEquipped(id, request.EquippedBadge, request.EquippedTitle, request.EquippedFrame);
                return Ok("Equipped");
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

        // A-1: batch cosmetics lookup. e.g. /api/users/cosmetics?ids=1,2,3
        [HttpGet("cosmetics")]
        public IActionResult GetCosmetics([FromQuery] string ids)
        {
            try
            {
                return Ok(_bl.GetCosmetics(ids));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Item 12 — register/clear this user's Expo push token for remote push.
        [HttpPut("{id}/pushtoken")]
        public IActionResult SetPushToken(int id, [FromBody] PushTokenRequest request)
        {
            try
            {
                _bl.SetPushToken(id, request?.Token);
                return Ok(new { ok = true });
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
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPut("{id}/baseline")]
        public IActionResult UpdateBaseline(int id, [FromBody] BaselineRequest request)
        {
            try
            {
                _bl.UpdateBaseline(id, request.DailyLoad, request.WeeklyLoad);
                return Ok("Baseline updated");
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

        [HttpPost("google-login")]
        public IActionResult GoogleLogin([FromBody] GoogleLoginRequest request)
        {
            try
            {
                var user = _bl.LoginOrCreateGoogleUser(request.GoogleId, request.Email, request.FullName ?? request.Email);
                if (user == null)
                    return StatusCode(500, "Google login failed");
                return Ok(user);
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

    public class BaselineRequest
    {
        public short DailyLoad { get; set; }
        public short WeeklyLoad { get; set; }
    }

    public class GoogleLoginRequest
    {
        public string GoogleId { get; set; }
        public string Email { get; set; }
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

}

