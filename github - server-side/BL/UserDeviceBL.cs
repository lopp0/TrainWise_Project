using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class UserDeviceBL
    {
        private readonly UserDeviceDAL _dal = new UserDeviceDAL();

        public int Create(UserDevice d)
        {
            if (d.UserID <= 0) throw new ArgumentException("UserID must be positive");
            if (string.IsNullOrWhiteSpace(d.DeviceName)) throw new ArgumentException("DeviceName is required");
            return _dal.Insert(d);
        }

        public void Update(UserDevice d)
        {
            if (d.DeviceID <= 0) throw new ArgumentException("DeviceID must be positive");
            _dal.Update(d);
        }

        public List<UserDevice> GetByUser(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            return _dal.GetByUser(userId);
        }
    }
}
