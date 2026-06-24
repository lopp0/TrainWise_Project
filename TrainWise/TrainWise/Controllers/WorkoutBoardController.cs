using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/board")]
    public class WorkoutBoardController : ControllerBase
    {
        private readonly BoardBL _bl = new BoardBL();

        // GET /api/board?viewerId=&country=IL&page=0&limit=20
        [HttpGet]
        public IActionResult GetFeed([FromQuery] int viewerId, [FromQuery] string country = "IL",
            [FromQuery] int page = 0, [FromQuery] int limit = 20)
        {
            try { return Ok(_bl.GetFeed(viewerId, country, page, limit)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpPost]
        public IActionResult Create([FromBody] CreateWorkoutPostRequest request)
        {
            try
            {
                var post = new WorkoutPost
                {
                    UserID = request.UserID,
                    ActivityLogId = request.ActivityLogId,
                    PostType = string.IsNullOrWhiteSpace(request.PostType) ? "record" : request.PostType,
                    Title = request.Title,
                    Description = request.Description,
                    MetricType = request.MetricType,
                    MetricValue = request.MetricValue,
                    ImagePath = request.ImagePath,
                    IsPublic = request.IsPublic
                };
                return Ok(new { postId = _bl.Create(post) });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // DELETE /api/board/{postId}?userId=  (own posts only)
        [HttpDelete("{postId:int}")]
        public IActionResult Delete(int postId, [FromQuery] int userId)
        {
            try { _bl.Delete(postId, userId); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // POST /api/board/{postId}/like/{userId}  (toggles; returns { liked })
        [HttpPost("{postId:int}/like/{userId:int}")]
        public IActionResult ToggleLike(int postId, int userId)
        {
            try { return Ok(new { liked = _bl.ToggleLike(postId, userId) }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // GET /api/board/leaderboard?country=IL&metric=load_weekly&limit=50
        [HttpGet("leaderboard")]
        public IActionResult GetLeaderboard([FromQuery] string country = "IL",
            [FromQuery] string metric = "load_weekly", [FromQuery] int limit = 50)
        {
            try { return Ok(_bl.GetLeaderboard(country, metric, limit)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // PUT /api/board/leaderboard/optin/{userId}?on=true
        [HttpPut("leaderboard/optin/{userId:int}")]
        public IActionResult SetOptIn(int userId, [FromQuery] bool on = true)
        {
            try { _bl.SetLeaderboardOptIn(userId, on); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}
