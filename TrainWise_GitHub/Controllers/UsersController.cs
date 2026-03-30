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
        public IActionResult Create([FromBody] User u)
        {
            try
            {
                int newId = _bl.Create(u);
                return CreatedAtAction(nameof(GetById), new { id = newId }, u);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}")]
        public IActionResult Update(int id, [FromBody] User u)
        {
            if (id != u.UserID)
                return BadRequest("ID mismatch");

            try
            {
                _bl.Update(u);
                return Ok("Updated");
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
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
    }
}
