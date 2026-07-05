using TrainWise.BL.Models;
using TrainWise.DAL;
namespace TrainWise.BL
{
    public class InjuryReportBL
    {
        private InjuryReportDAL _dal = null!;
        private UserDAL _userDal = null!;
        public InjuryReportBL()
        {
            _dal = new InjuryReportDAL();
            _userDal = new UserDAL();
        }

        // Owner (trainee UserID) of an injury row, for authorization.
        public int? GetOwnerUserId(int injuryId) => _dal.GetOwnerUserId(injuryId);

        public int Create(InjuryReport ir)
        {
            if (ir.UserID <= 0)
                throw new ArgumentException("UserID is required");

            if (ir.InjuryTypeID <= 0)
                throw new ArgumentException("InjuryTypeID is required");

            if (ir.Severity < 1 || ir.Severity > 10)
                throw new ArgumentException("Severity must be between 1 and 10");
          
            if (ir.Date.Date > DateTime.Today)
                throw new ArgumentException("Date cannot be in the future");

            if (_userDal.GetUserById(ir.UserID) == null)
                throw new ArgumentException("User does not exist");

            ir.IsActiveInjury = true;

            return _dal.InsertInjuryReport(ir);
        }

        public List<InjuryReport> GetByUser(int userId)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            return _dal.GetInjuriesByUser(userId);
        }

        public List<InjuryReport> GetActiveByUser(int userId)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            return _dal.GetActiveInjuriesByUser(userId);
        }

        public void MarkRecovered(int injuryId)
        {
            if (injuryId <= 0)
                throw new ArgumentException("InjuryID must be positive");

            _dal.MarkRecovered(injuryId);
        }

        // #127 — daily pain-level tracking.
        public int AddPainLog(int injuryId, int level, string? note)
        {
            if (injuryId <= 0) throw new ArgumentException("InjuryID must be positive");
            if (level < 1 || level > 10) throw new ArgumentException("Pain level must be between 1 and 10");
            return _dal.InsertPainLog(injuryId, level, note);
        }

        public List<PainLog> GetPainLogs(int injuryId)
        {
            if (injuryId <= 0) throw new ArgumentException("InjuryID must be positive");
            return _dal.GetPainLogs(injuryId);
        }
    }
}

