using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.IO;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MessagesController : BaseApiController
    {
        private readonly MessageBL _bl = new MessageBL();

        // POST /api/messages  — send a message (text and/or image)
        [HttpPost]
        public IActionResult Send([FromBody] SendMessageRequest request)
        {
            // Can't send a message AS another user (spoofed SenderID).
            if (!CallerMayAct(request.SenderID)) return Forbid();
            try
            {
                var saved = _bl.Send(new Message
                {
                    SenderID = request.SenderID,
                    ReceiverID = request.ReceiverID,
                    Text = request.Text,
                    ImagePath = request.ImagePath,
                    AudioPath = request.AudioPath,
                    VideoPath = request.VideoPath
                });
                return Ok(saved);
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

        // POST /api/messages/upload — store a chat image, return its path.
        // The client then sends a message with that ImagePath.
        [HttpPost("upload")]
        public async Task<IActionResult> UploadImage(IFormFile file,
            [FromServices] IWebHostEnvironment env)
        {
            // Validate size + real image type; derive the extension from the
            // sniffed bytes (not the client file name) to prevent stored XSS via
            // an uploaded .html/.svg served from wwwroot.
            if (!UploadValidator.TryValidateImage(file, out string ext, out string uploadError))
                return BadRequest(uploadError);

            string webRoot = env.WebRootPath
                ?? Path.Combine(env.ContentRootPath, "wwwroot");
            string folder = Path.Combine(webRoot, "images");
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);

            // Random, non-enumerable name — chat images sit in the public
            // wwwroot/images and must not be guessable from a timestamp.
            string fileName = $"chat_{Guid.NewGuid():N}{ext}";
            string fullPath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { path = "/images/" + fileName });
        }

        // POST /api/messages/upload/audio — #139 voice message. Returns { path }.
        [HttpPost("upload/audio")]
        public Task<IActionResult> UploadAudio(IFormFile file, [FromServices] IWebHostEnvironment env)
        {
            if (!UploadValidator.TryValidateAudio(file, out string ext, out string err))
                return Task.FromResult<IActionResult>(BadRequest(err));
            return SaveMedia(file, env, "voice_", ext);
        }

        // POST /api/messages/upload/video — #135 form-check video. Returns { path }.
        // Raise the per-request body cap above Kestrel's ~28 MB default so a
        // clip up to the validator's 100 MB limit isn't 413'd before validation.
        [RequestSizeLimit(105L * 1024 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = 105L * 1024 * 1024)]
        [HttpPost("upload/video")]
        public Task<IActionResult> UploadVideo(IFormFile file, [FromServices] IWebHostEnvironment env)
        {
            if (!UploadValidator.TryValidateVideo(file, out string ext, out string err))
                return Task.FromResult<IActionResult>(BadRequest(err));
            return SaveMedia(file, env, "clip_", ext);
        }

        // Shared writer for chat media (audio/video). Random, non-enumerable name
        // under wwwroot/media (served by UseStaticFiles like /images).
        private static async Task<IActionResult> SaveMedia(IFormFile file,
            IWebHostEnvironment env, string prefix, string ext)
        {
            string webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
            string folder = Path.Combine(webRoot, "media");
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);

            string fileName = $"{prefix}{Guid.NewGuid():N}{ext}";
            string fullPath = Path.Combine(folder, fileName);
            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            return new OkObjectResult(new { path = "/media/" + fileName });
        }

        // GET /api/messages/conversation/{userA}/{userB}  — full thread
        [HttpGet("conversation/{userA}/{userB}")]
        public IActionResult GetConversation(int userA, int userB)
        {
            // Only a participant may read the thread.
            if (!CallerMayActEither(userA, userB)) return Forbid();
            try
            {
                return Ok(_bl.GetConversation(userA, userB));
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

        // PUT /api/messages/seen/{senderId}/{receiverId}
        // Receiver opened the chat: mark sender->receiver messages as seen.
        [HttpPut("seen/{senderId}/{receiverId}")]
        public IActionResult MarkSeen(int senderId, int receiverId)
        {
            // Only the receiver marks their own messages as seen.
            if (!CallerMayAct(receiverId)) return Forbid();
            try
            {
                int updated = _bl.MarkSeen(senderId, receiverId);
                return Ok(new { updated });
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

        // GET /api/messages/unread/{userId}  — badge count
        [HttpGet("unread/{userId}")]
        public IActionResult GetUnreadCount(int userId)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try
            {
                return Ok(new { count = _bl.GetUnreadCount(userId) });
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

        // #138 — PUT /api/messages/typing/{fromUserId}/{toUserId}  body { isTyping }
        [HttpPut("typing/{fromUserId:int}/{toUserId:int}")]
        public IActionResult SetTyping(int fromUserId, int toUserId, [FromBody] TypingRequest request)
        {
            if (!CallerMayAct(fromUserId)) return Forbid();
            try
            {
                _bl.SetTyping(fromUserId, toUserId, request?.IsTyping ?? false);
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // #138 — GET /api/messages/typing/{fromUserId}/{toUserId}  → { typing }
        [HttpGet("typing/{fromUserId:int}/{toUserId:int}")]
        public IActionResult GetTyping(int fromUserId, int toUserId)
        {
            if (!CallerMayActEither(fromUserId, toUserId)) return Forbid();
            try { return Ok(new { typing = _bl.IsTyping(fromUserId, toUserId) }); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // #140 — POST /api/messages/{messageId}/react/{userId}  body { emoji }
        [HttpPost("{messageId:int}/react/{userId:int}")]
        public IActionResult React(int messageId, int userId, [FromBody] ReactRequest request)
        {
            if (!CallerMayAct(userId)) return Forbid();
            try
            {
                _bl.React(messageId, userId, request?.Emoji ?? "");
                return Ok(new { ok = true });
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }

        // #140 — GET /api/messages/reactions/{userA}/{userB}  → all thread reactions
        [HttpGet("reactions/{userA:int}/{userB:int}")]
        public IActionResult GetReactions(int userA, int userB)
        {
            if (!CallerMayActEither(userA, userB)) return Forbid();
            try { return Ok(_bl.GetThreadReactions(userA, userB)); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
            catch (Exception) { return StatusCode(500, "An unexpected error occurred."); }
        }
    }

    public class TypingRequest { public bool IsTyping { get; set; } }
    public class ReactRequest { public string? Emoji { get; set; } }
}
