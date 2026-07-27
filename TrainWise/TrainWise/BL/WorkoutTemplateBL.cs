using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // #119 — reusable workout templates. Validates + clamps server-side.
    public class WorkoutTemplateBL
    {
        private readonly WorkoutTemplateDAL _dal = new WorkoutTemplateDAL();

        private const int MaxNameLen = 80;
        private const int MaxDuration = 600;   // minutes
        private const int MaxPerUser = 50;     // keep the picker manageable / cap abuse

        public WorkoutTemplate Create(WorkoutTemplate t)
        {
            if (t.UserID <= 0) throw new ArgumentException("UserID is required");
            if (string.IsNullOrWhiteSpace(t.Name)) throw new ArgumentException("Template name is required");
            t.Name = t.Name.Trim();
            if (t.Name.Length > MaxNameLen) t.Name = t.Name[..MaxNameLen];

            if (t.ActivityTypeID <= 0) throw new ArgumentException("ActivityTypeID is required");
            if (t.Duration < 1) t.Duration = 1;
            if (t.Duration > MaxDuration) t.Duration = MaxDuration;
            if (t.ExertionLevel < 1) t.ExertionLevel = 1;
            if (t.ExertionLevel > 10) t.ExertionLevel = 10;
            if (t.TargetValue.HasValue && (t.TargetValue.Value < 0 || double.IsNaN(t.TargetValue.Value)))
                t.TargetValue = null;

            if (_dal.GetByUser(t.UserID).Count >= MaxPerUser)
                throw new ArgumentException($"Template limit reached ({MaxPerUser}). Delete one first.");

            return _dal.Insert(t);
        }

        public List<WorkoutTemplate> GetByUser(int userId)
        {
            if (userId <= 0) throw new ArgumentException("UserID is required");
            return _dal.GetByUser(userId);
        }

        public int? GetOwnerUserId(int templateId) => _dal.GetOwnerUserId(templateId);

        public void Delete(int templateId)
        {
            if (templateId <= 0) throw new ArgumentException("TemplateID is required");
            _dal.Delete(templateId);
        }
    }
}
