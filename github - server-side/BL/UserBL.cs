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

            if (u.ActivityLevel < 1 || u.ActivityLevel > 3)
                throw new ArgumentException("ActivityLevel must be between 1 and 3");

            if (string.IsNullOrWhiteSpace(u.DeviceType))
                throw new ArgumentException("DeviceType is required");

            if (string.IsNullOrWhiteSpace(u.UserName))
                throw new ArgumentException("UserName is required");

            if (string.IsNullOrWhiteSpace(u.Email))
                throw new ArgumentException("Email is required");

            if (string.IsNullOrWhiteSpace(u.Password))
                throw new ArgumentException("Password is required");

            if (u.Password.Length < 4)
                throw new ArgumentException("Password must have minimum 4 characters");

            if (u.ExperienceLevel < 1 || u.ExperienceLevel > 3)
                throw new ArgumentException("ExperienceLevel must be 1 (Beginner), 2 (Regular), or 3 (Advanced)");

            if (!u.HealthDeclaration)
                throw new ArgumentException("Health declaration must be accepted");

            if (!u.ConfirmTerms)
                throw new ArgumentException("Terms and conditions must be confirmed");

            int newUserId = _dal.InsertUser(u);

            if (u.IsCoach)
            {
                CoachDAL coachDal = new CoachDAL();
                coachDal.InsertCoach(newUserId, u.FullName, u.Email);
            }

            return newUserId;
        }

        public void Update(User u)
        {
            if (u.UserID <= 0)
                throw new ArgumentException("UserID is required");

            if (string.IsNullOrWhiteSpace(u.FullName))
                throw new ArgumentException("Full name is required");

            if (u.Height <= 0 || u.Weight <= 0)
                throw new ArgumentException("Height and Weight must be positive");

            if (u.ActivityLevel < 1 || u.ActivityLevel > 3)
                throw new ArgumentException("Activity Level must be between 1 and 3");

            if (u.ExperienceLevel < 1 || u.ExperienceLevel > 3)
                throw new ArgumentException("Experience Level must be 1, 2, or 3");

            _dal.UpdateUser(u);
        }

       public void Delete(int userId)
        {
        if (userId <= 0)
            throw new ArgumentException("UserID must be positive")
        var user = _dal.GetUserById(userId);
        if (user != null && user.IsCoach)
        {
            CoachDAL coachDal = new CoachDAL();
            var coach = coachDal.GetCoachByUserId(userId);
            if (coach != null)
                coachDal.DeleteCoach(coach.CoachID);
        }

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

        public UserSummary? GetSummary(int userId)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            return _dal.GetUserSummary(userId);
        }

        public void SetProfileImagePath(int userId, string relativePath)
        {
            if (userId <= 0) throw new ArgumentException("UserID must be positive");
            if (string.IsNullOrWhiteSpace(relativePath)) throw new ArgumentException("Path is required");

            _dal.UpdateUserProfileImage(userId, relativePath);

        }

        public void UpdateBaseline(int userId, short dailyLoad, short weeklyLoad)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            if (dailyLoad <= 0)
                throw new ArgumentException("BaseLineDailyLoad must be positive");

            if (weeklyLoad <= 0)
                throw new ArgumentException("BaseLineWeeklyLoad must be positive");

            if (_dal.GetUserById(userId) == null)
                throw new ArgumentException("User does not exist");

            _dal.UpdateUserBaseline(userId, dailyLoad, weeklyLoad);
        }
    }

}
