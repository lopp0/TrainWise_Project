using Microsoft.AspNetCore.Mvc;
using TrainWise.BL;
using TrainWise.BL.Models;

namespace TrainWise.Controllers
{
    [ApiController]
    [Route("api/users/{userId}/devices")]
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
        public IActionResult Create(int userId, [FromBody] CreateDeviceRequest request)
        {
            try
            {
                var d = new UserDevice
                {
                    UserID = userId,
                    DeviceName = request.DeviceName,
                    LastSync = request.LastSync,
                    PermissionsGranted = request.PermissionsGranted
                };

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
        public IActionResult Update(int userId, int deviceId, [FromBody] UpdateDeviceRequest request)
        {
            try
            {
                var d = new UserDevice
                {
                    UserID = userId,
                    DeviceID = deviceId,
                    DeviceName = request.DeviceName,
                    LastSync = request.LastSync,
                    PermissionsGranted = request.PermissionsGranted
                };
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
