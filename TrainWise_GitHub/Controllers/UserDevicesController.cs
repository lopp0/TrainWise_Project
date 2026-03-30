using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    public class UserDevicesController :ControllerBase
    {
        private readonly UserDeviceBL _bl = new UserDeviceBL();

        [HttpGet]
        public IActionResult GetDevices(int userId)
        {
            try
            {
                return Ok(_bl.GetByUser(userId));
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

        [HttpPost]
        public IActionResult Create(int userId, [FromBody] UserDevice d)
        {
            try
            {
                d.UserID = userId;
                int id = _bl.Create(d);
                d.DeviceID = id;
                return Ok(d);
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

        [HttpPut("{deviceId}")]
        public IActionResult Update(int userId, int deviceId, [FromBody] UserDevice d)
        {
            try
            {
                d.UserID = userId;
                d.DeviceID = deviceId;
                _bl.Update(d);
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
    }
}
