using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class UserBL
    {
        private UserDAL _dal = null!;

        public UserBL()
        {
            _dal = new UserDAL();
        }

        public int Create(User u)
        {
            if (string.IsNullOrWhiteSpace(u.FullName))
                throw new ArgumentException("Full name is required");

            if (u.BirthYear < 1950 || u.BirthYear > DateTime.Now.Year)
                throw new ArgumentException("BirthYear is not valid");

            if (u.Height <= 0 || u.Weight <= 0)
                throw new ArgumentException("Height and Weight must be positive");

            if (u.ActivityLevel < 1 || u.ActivityLevel > 5)
                throw new ArgumentException("ActivityLevel must be between 1 and 5");

            if (string.IsNullOrWhiteSpace(u.DeviceType))
                throw new ArgumentException("DeviceType is required");

            return _dal.InsertUser(u);
        }

        public void Update(User u)
        {
            if (u.UserID <= 0)
                throw new ArgumentException("UserID is required");

            if (string.IsNullOrWhiteSpace(u.FullName))
                throw new ArgumentException("Full name is required");

            _dal.UpdateUser(u);
        }

        public void Delete(int userId)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            _dal.DeleteUser(userId);
        }

        public User? GetById(int userId)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            return _dal.GetUserById(userId);
        }

        public List<User> GetAll()
        {
            return _dal.GetAllUsers();
        }

        public void SetProfileImagePath(int userId, string relativePath)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            if (string.IsNullOrWhiteSpace(relativePath)) throw new ArgumentException("Path is required");

            _dal.UpdateUserProfileImage(userId, relativePath);

        }

    }

}
