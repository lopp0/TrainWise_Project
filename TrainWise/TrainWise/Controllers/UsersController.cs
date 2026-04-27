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
        public async Task<IActionResult> UploadImage(int id, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            var user = _bl.GetById(id);
            if (user == null)
                return NotFound("User not found");

            string folder = Path.Combine("wwwroot", "images");
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);

            string fileName = $"{id}_{file.FileName}";
            string fullPath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            string relativePath = $"images/{fileName}";
            _bl.SetProfileImagePath(id, relativePath);

            return Ok(new { path = "/" + relativePath });
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
    }

    public class BaselineRequest
    {
        public short DailyLoad { get; set; }
        public short WeeklyLoad { get; set; }
    }
}

