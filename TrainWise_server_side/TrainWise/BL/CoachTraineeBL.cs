using System.Linq;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class CoachTraineeBL
    {
        private readonly CoachTraineeDAL _dal = new CoachTraineeDAL();
        private readonly CoachDAL _coachDal = new CoachDAL();
        private readonly UserDAL _userDal = new UserDAL();

        public void Connect(int coachId, int userId)
        {
            if (coachId <= 0) throw new ArgumentException("CoachID must be positive");
            if (userId <= 0) throw new ArgumentException("UserID must be positive");

            if (_coachDal.GetCoachById(coachId) == null)
                throw new ArgumentException("Coach does not exist");

            if (_userDal.GetUserById(userId) == null)
                throw new ArgumentException("User does not exist");

            // Reject re-linking an existing pair so the app can show an
            // "already connected" message instead of a silent success. Reuses
            // the existing trainees query to avoid a new stored procedure.
            bool alreadyLinked = _coachDal.GetTraineesWithLoad(coachId)
                .Any(t => t.UserID == userId);
            if (alreadyLinked)
                throw new InvalidOperationException("You are already connected with this user.");

            _dal.ConnectTrainee(coachId, userId);
        }

        public void Disconnect(int coachId, int userId)
        {
            if (coachId <= 0) throw new ArgumentException("CoachID must be positive");
            if (userId <= 0) throw new ArgumentException("UserID must be positive");

            _dal.DisconnectTrainee(coachId, userId);
        }
    }
}
