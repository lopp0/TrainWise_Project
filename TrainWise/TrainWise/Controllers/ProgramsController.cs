using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    // #133 — Assigned training programs. A coach builds a program and assigns it
    // to a trainee (fanning out onto the trainee's calendar); each assignment has
    // a per-program discussion thread (reuses the group-chat client UI).
    [ApiController]
    [Route("api/programs")]
    public class ProgramsController : BaseApiController
    {
        private readonly ProgramBL _bl = new ProgramBL();

        // ── programs (coach owns them) ───────────────────────────────────────────
        [HttpPost("coach/{coachUserId:int}")]
        public IActionResult Create(int coachUserId, [FromBody] CreateProgramRequest body)
        {
            if (!CallerMayAct(coachUserId)) return Forbid();
            try { return Ok(new { programId = _bl.CreateProgram(coachUserId, body) }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "Could not create the program."); }
        }

        [HttpGet("coach/{coachUserId:int}")]
        public IActionResult ListForCoach(int coachUserId)
        {
            if (!CallerMayAct(coachUserId)) return Forbid();
            try { return Ok(_bl.GetProgramsByCoach(coachUserId)); }
            catch (Exception) { return StatusCode(500, "Could not load programs."); }
        }

        [HttpGet("{programId:int}")]
        public IActionResult Get(int programId)
        {
            var coachId = _bl.GetProgramCoachId(programId);
            if (coachId == null) return NotFound("Program not found");
            if (!CallerMayAct(coachId.Value)) return Forbid();
            try { return Ok(_bl.GetProgram(programId)); }
            catch (Exception) { return StatusCode(500, "Could not load the program."); }
        }

        [HttpPut("{programId:int}")]
        public IActionResult Update(int programId, [FromBody] CreateProgramRequest body)
        {
            var coachId = _bl.GetProgramCoachId(programId);
            if (coachId == null) return NotFound("Program not found");
            if (!CallerMayAct(coachId.Value)) return Forbid();
            try { _bl.UpdateProgram(programId, body); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "Could not update the program."); }
        }

        [HttpDelete("{programId:int}")]
        public IActionResult Delete(int programId)
        {
            var coachId = _bl.GetProgramCoachId(programId);
            if (coachId == null) return NotFound("Program not found");
            if (!CallerMayAct(coachId.Value)) return Forbid();
            try { _bl.DeleteProgram(programId); return Ok(new { ok = true }); }
            catch (Exception) { return StatusCode(500, "Could not delete the program."); }
        }

        // ── assignment ───────────────────────────────────────────────────────────
        [HttpPost("{programId:int}/assign")]
        public IActionResult Assign(int programId, [FromBody] AssignProgramRequest body)
        {
            if (body == null) return BadRequest("Body required");
            var coachId = _bl.GetProgramCoachId(programId);
            if (coachId == null) return NotFound("Program not found");
            // caller must be the program's coach AND be linked to that trainee.
            if (!CallerMayAct(coachId.Value)) return Forbid();
            if (!CallerOwnsOrCoaches(body.TraineeUserId)) return Forbid();
            try { return Ok(new { assignmentId = _bl.AssignProgram(programId, body.TraineeUserId, body.StartDate, coachId.Value) }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "Could not assign the program."); }
        }

        [HttpGet("assignments/trainee/{traineeUserId:int}")]
        public IActionResult ListForTrainee(int traineeUserId)
        {
            if (!CallerOwnsOrCoaches(traineeUserId)) return Forbid();
            try { return Ok(_bl.GetAssignmentsForTrainee(traineeUserId)); }
            catch (Exception) { return StatusCode(500, "Could not load assignments."); }
        }

        [HttpGet("assignments/coach/{coachUserId:int}")]
        public IActionResult ListAssignmentsForCoach(int coachUserId)
        {
            if (!CallerMayAct(coachUserId)) return Forbid();
            try { return Ok(_bl.GetAssignmentsForCoach(coachUserId)); }
            catch (Exception) { return StatusCode(500, "Could not load assignments."); }
        }

        [HttpGet("assignments/{assignmentId:int}")]
        public IActionResult GetAssignment(int assignmentId)
        {
            var a = _bl.GetAssignment(assignmentId);
            if (a == null) return NotFound("Assignment not found");
            if (!IsParticipant(a)) return Forbid();
            // include the program's workouts so the detail screen can render the plan
            var prog = _bl.GetProgram(a.ProgramID);
            return Ok(new { assignment = a, program = prog });
        }

        [HttpDelete("assignments/{assignmentId:int}")]
        public IActionResult DeleteAssignment(int assignmentId)
        {
            var a = _bl.GetAssignment(assignmentId);
            if (a == null) return NotFound("Assignment not found");
            if (!CallerMayAct(a.CoachUserID)) return Forbid();   // only the coach unassigns
            try { _bl.DeleteAssignment(assignmentId); return Ok(new { ok = true }); }
            catch (Exception) { return StatusCode(500, "Could not remove the assignment."); }
        }

        // ── per-assignment chat (participants only) ──────────────────────────────
        [HttpGet("assignments/{assignmentId:int}/messages")]
        public IActionResult GetMessages(int assignmentId, [FromQuery] int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            var a = _bl.GetAssignment(assignmentId);
            if (a == null) return NotFound("Assignment not found");
            if (!IsParticipant(a, userId)) return Forbid();
            try { return Ok(_bl.GetMessages(assignmentId, userId)); }
            catch (Exception) { return StatusCode(500, "Could not load the chat."); }
        }

        [HttpPost("assignments/{assignmentId:int}/messages")]
        public IActionResult PostMessage(int assignmentId, [FromBody] PostProgramMessageRequest req)
        {
            if (req == null) return BadRequest("Body required");
            if (!CallerMayAct(req.SenderId)) return Forbid();
            var a = _bl.GetAssignment(assignmentId);
            if (a == null) return NotFound("Assignment not found");
            if (!IsParticipant(a, req.SenderId)) return Forbid();
            try { return Ok(_bl.PostMessage(assignmentId, req.SenderId, req.Text, req.ImagePath, req.VideoPath, req.AudioPath)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "Message not sent."); }
        }

        [HttpPost("assignments/{assignmentId:int}/messages/{messageId:int}/react")]
        public IActionResult React(int assignmentId, int messageId, [FromBody] ReactProgramMessageRequest req)
        {
            if (req == null) return BadRequest("Body required");
            if (!CallerMayAct(req.UserId)) return Forbid();
            var a = _bl.GetAssignment(assignmentId);
            if (a == null) return NotFound("Assignment not found");
            if (!IsParticipant(a, req.UserId)) return Forbid();
            try { _bl.React(messageId, req.UserId, req.Emoji); return Ok(new { ok = true }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "Could not react."); }
        }

        [HttpGet("assignments/{assignmentId:int}/reactions")]
        public IActionResult GetReactions(int assignmentId, [FromQuery] int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            var a = _bl.GetAssignment(assignmentId);
            if (a == null) return NotFound("Assignment not found");
            if (!IsParticipant(a, userId)) return Forbid();
            try { return Ok(_bl.GetReactions(assignmentId)); }
            catch (Exception) { return StatusCode(500, "Could not load reactions."); }
        }

        // A chat participant is the assignment's trainee or its coach. When a token
        // is present we also require the acting userId to match the caller (done by
        // CallerMayAct at each call site); tokenless callers pass (pre-enforcement).
        private static bool IsParticipant(ProgramAssignment a, int userId) =>
            userId == a.TraineeUserID || userId == a.CoachUserID;

        private bool IsParticipant(ProgramAssignment a) =>
            CallerId == null || CallerId.Value == a.TraineeUserID || CallerId.Value == a.CoachUserID;
    }
}
