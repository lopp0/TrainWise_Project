using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    // #134 — coach comments on a specific workout log.
    [ApiController]
    [Route("api/workoutcomments")]
    public class WorkoutCommentsController : BaseApiController
    {
        private readonly WorkoutCommentBL _bl = new WorkoutCommentBL();

        // GET /api/workoutcomments/{activityId}
        [HttpGet("{activityId:int}")]
        public IActionResult Get(int activityId)
        {
            try { return Ok(_bl.GetComments(activityId)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // POST /api/workoutcomments/{activityId}  body { authorUserID, text }
        [HttpPost("{activityId:int}")]
        public IActionResult Add(int activityId, [FromBody] AddWorkoutCommentRequest req)
        {
            if (req == null) return BadRequest("Body required");
            if (!CallerMayAct(req.AuthorUserID)) return Forbid();
            try { return Ok(new { commentId = _bl.AddComment(activityId, req.AuthorUserID, req.Text) }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // DELETE /api/workoutcomments/comment/{commentId}?userId=  (own comments)
        [HttpDelete("comment/{commentId:int}")]
        public IActionResult Delete(int commentId, [FromQuery] int userId)
        {
            var author = _bl.GetCommentAuthor(commentId);
            if (author == 0) return NotFound("Comment not found");
            if (!CallerMayAct(author)) return Forbid();
            if (author != userId) return Forbid();
            try { _bl.DeleteComment(commentId); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}
