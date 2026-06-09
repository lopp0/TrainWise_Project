using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MessagesController : ControllerBase
    {
        private readonly MessageBL _bl = new MessageBL();

        // POST /api/messages  — send a message (text and/or image)
        [HttpPost]
        public IActionResult Send([FromBody] SendMessageRequest request)
        {
            try
            {
                var saved = _bl.Send(new Message
                {
                    SenderID = request.SenderID,
                    ReceiverID = request.ReceiverID,
                    Text = request.Text,
                    ImagePath = request.ImagePath
                });
                return Ok(saved);
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

        // POST /api/messages/upload — store a chat image, return its path.
        // The client then sends a message with that ImagePath.
        [HttpPost("upload")]
        public async Task<IActionResult> UploadImage(IFormFile file,
            [FromServices] IWebHostEnvironment env)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            string webRoot = env.WebRootPath
                ?? Path.Combine(env.ContentRootPath, "wwwroot");
            string folder = Path.Combine(webRoot, "images");
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);

            string ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
            string fileName = $"chat_{DateTime.UtcNow.Ticks}{ext}";
            string fullPath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { path = "/images/" + fileName });
        }

        // GET /api/messages/conversation/{userA}/{userB}  — full thread
        [HttpGet("conversation/{userA}/{userB}")]
        public IActionResult GetConversation(int userA, int userB)
        {
            try
            {
                return Ok(_bl.GetConversation(userA, userB));
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

        // PUT /api/messages/seen/{senderId}/{receiverId}
        // Receiver opened the chat: mark sender->receiver messages as seen.
        [HttpPut("seen/{senderId}/{receiverId}")]
        public IActionResult MarkSeen(int senderId, int receiverId)
        {
            try
            {
                int updated = _bl.MarkSeen(senderId, receiverId);
                return Ok(new { updated });
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

        // GET /api/messages/unread/{userId}  — badge count
        [HttpGet("unread/{userId}")]
        public IActionResult GetUnreadCount(int userId)
        {
            try
            {
                return Ok(new { count = _bl.GetUnreadCount(userId) });
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
}
