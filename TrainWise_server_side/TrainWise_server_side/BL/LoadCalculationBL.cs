using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    public class LoadCalculationBL
    {
        private readonly DailyLoadDAL _loadDal = new DailyLoadDAL();
        private readonly UserDAL _userDal = new UserDAL();

        public DailyLoad CalculateAndSave(int userId, DateTime date)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            if (date.Date > DateTime.Today)
                throw new ArgumentException("Date cannot be in the future");

            if (_userDal.GetUserById(userId) == null)
                throw new ArgumentException("User does not exist");

            // Step 1 — fetch last 28 days of confirmed session loads from SQL
            var sessions = _loadDal.GetActivityLogsForLoad(userId, date);

            // Step 2 — fetch user context: baseline values, thresholds, HasActiveInjury
            var context = _loadDal.GetUserLoadContext(userId);

            // Step 3 — compute AcuteLoad (last 7 days, sum) and ChronicLoad
            //   (28-day rolling weekly average = 28-day sum / 4). The ACWR
            //   thresholds in LoadParameters assume weekly-equivalent units
            //   on both sides; without the /4, ratio can never exceed 1.0
            //   and the status is permanently "Green".

            double acuteLoad = sessions
                .Where(s => s.StartTime.Date >= date.Date.AddDays(-6))
                .Sum(s => s.CalculatedLoadForSession);

            double chronic28Sum = sessions
                .Sum(s => s.CalculatedLoadForSession);
            double chronicLoad = chronic28Sum / 4.0;


            // Step 4 — compute AC Ratio
            double? acRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : (double?)null;

            // Step 5 — compute StressScore (0-100 scale)
            int stressScore = ComputeStressScore(acuteLoad, context);

            // Step 6 — determine LoadLevel using thresholds, tighter if active injury exists
            string loadLevel = DetermineLoadLevel(acRatio, context.HasActiveInjury, context.Parameters);

            // Step 7 — build the DailyLoad object
            var dailyLoad = new DailyLoad
            {
                UserID = userId,
                Date = date.Date,
                AcuteLoad = acuteLoad,
                ChronicLoad = chronicLoad,
                AC_Ratio = acRatio,
                StressScore = stressScore,
                LoadLevel = loadLevel
            };

            // Step 8 — save to DB via sp_SaveDailyLoad
            dailyLoad.LoadID = _loadDal.SaveDailyLoad(dailyLoad);

            // Step 9 — check if baseline should be established
            if (!context.IsBaselineEstablished && sessions
                .Select(s => s.StartTime.Date)
                .Distinct()
                .Count() >= 7)
            {
                short newDailyBaseline = (short)Math.Round(acuteLoad / 7);
                short newWeeklyBaseline = (short)Math.Round(acuteLoad);
                _userDal.UpdateUserBaseline(userId, newDailyBaseline, newWeeklyBaseline);
            }

            return dailyLoad;
        }

        public List<DailyLoad> GetByUser(int userId)
        {
            if (userId <= 0)
                throw new ArgumentException("UserID must be positive");

            return _loadDal.GetDailyLoadByUser(userId);
        }

        private int ComputeStressScore(double acuteLoad, UserLoadContext context)
        {
            double baseline = context.IsBaselineEstablished
                ? context.BaseLineDailyLoad * 7  
                : GetBootstrapAcuteLoad(context.ExperienceLevel, context.Parameters);

            if (baseline <= 0) return 0;

            double ratio = acuteLoad / baseline;
            int score = (int)Math.Round(ratio * 50);
            return Math.Clamp(score, 0, 100);
        }

        private string DetermineLoadLevel(double? acRatio, bool hasActiveInjury, LoadParameters p)
        {
            //   Green  : ratio < 0.8
            //   Yellow : 0.8 <= ratio <= 1.3
            //   Red    : ratio > 1.3
            // Injured users use tighter bands per the same doc.

            if (acRatio == null) return "Green";

            double ratio = acRatio.Value;

            if (hasActiveInjury)
            {
                if (ratio >= 1.2) return "Red";
                if (ratio >= 0.8 && ratio <= 1.1) return "Yellow";
                return "Green";
            }

            if (ratio > 1.3) return "Red";
            if (ratio >= 0.8) return "Yellow";
            return "Green";
        }

        private double GetBootstrapAcuteLoad(byte experienceLevel, LoadParameters p)
        {
            return experienceLevel switch
            {
                1 => p.BeginnerAcuteLoad,
                2 => p.RegularAcuteLoad,
                3 => p.AdvanceAcuteLoad,

                _ => p.BeginnerAcuteLoad
            };
        }
    }
}
