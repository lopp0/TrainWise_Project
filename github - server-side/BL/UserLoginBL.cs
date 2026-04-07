using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class UserLoginBL
    {
        private readonly UserDAL _userDal = new UserDAL();

        public User Login(string email, string password)
        {
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email is required");

            if (string.IsNullOrWhiteSpace(password))
                throw new ArgumentException("Password is required");

            User? user = _userDal.LoginUser(email, password);

            if (user == null)
                throw new UnauthorizedAccessException("Invalid email or password");

            return user;
        }
    }
}
