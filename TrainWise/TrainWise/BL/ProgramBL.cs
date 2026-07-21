using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    // #133 — Assigned training programs business logic. Validates + clamps every
    // input server-side (client validation is UX only), fans a program out onto
    // the trainee's calendar on assign, and orchestrates a clean unassign/delete.
    public class ProgramBL
    {
        private readonly ProgramDAL _dal = new ProgramDAL();
        private readonly UserDAL _userDal = new UserDAL();

        // ── programs ────────────────────────────────────────────────────────────
        public int CreateProgram(int coachUserId, CreateProgramRequest req)
        {
            var prog = BuildProgram(req);
            prog.CoachUserID = coachUserId;
            return _dal.CreateProgram(prog);
        }

        // Edit an existing program. Does NOT retro-update calendars of programs
        // already assigned (fan-out happens at assign time) — unassign + reassign
        // to apply. Caller must have verified ownership.
        public void UpdateProgram(int programId, CreateProgramRequest req)
        {
            var prog = BuildProgram(req);
            prog.ProgramID = programId;
            _dal.UpdateProgram(prog);
        }

        // Shared validation/clamping for create + update. The program is a weekly
        // PATTERN keyed by day of week, so WeekNumber is forced to 1 (repetition
        // across weeks happens in the fan-out from DurationWeeks).
        private TrainingProgram BuildProgram(CreateProgramRequest req)
        {
            if (req == null) throw new ArgumentException("Body required");
            var name = (req.Name ?? "").Trim();
            if (name.Length == 0) throw new ArgumentException("Program name is required");
            if (name.Length > 120) name = name.Substring(0, 120);

            int weeks = Clamp(req.DurationWeeks, 1, 52);
            var prog = new TrainingProgram
            {
                Name = name,
                Description = Trim(req.Description, 1000),
                DurationWeeks = weeks,
            };

            foreach (var w in req.Workouts ?? new List<ProgramWorkoutRequest>())
            {
                prog.Workouts.Add(new ProgramWorkout
                {
                    WeekNumber = 1,
                    DayOfWeek = Clamp(w.DayOfWeek, 0, 6),
                    ActivityTypeID = w.ActivityTypeId,
                    Duration = w.Duration.HasValue ? Clamp(w.Duration.Value, 1, 600) : (int?)null,
                    Distance = w.Distance.HasValue ? Math.Max(0, w.Distance.Value) : (double?)null,
                    Load = w.Load.HasValue ? Math.Max(0, w.Load.Value) : (double?)null,
                    Notes = Trim(w.Notes, 500),
                });
            }

            if (prog.Workouts.Count == 0)
                throw new ArgumentException("Add at least one workout to the program");
            if (prog.Workouts.Count > 200)
                throw new ArgumentException("Too many workouts in one program");
            return prog;
        }

        public List<TrainingProgram> GetProgramsByCoach(int coachUserId) => _dal.GetProgramsByCoach(coachUserId);
        public TrainingProgram GetProgram(int programId) => _dal.GetProgram(programId);
        public int? GetProgramCoachId(int programId) => _dal.GetProgramCoachId(programId);

        // Delete a template: first unassign every assignment (removing the calendar
        // rows it generated), then delete the program itself. Keeps FKs happy and
        // never orphans a trainee's calendar.
        public void DeleteProgram(int programId)
        {
            foreach (var assignmentId in _dal.GetAssignmentIdsForProgram(programId))
                _dal.DeleteAssignment(assignmentId);
            _dal.DeleteProgram(programId);
        }

        // ── assignment ───────────────────────────────────────────────────────────
        public int AssignProgram(int programId, int traineeUserId, string startDateStr, int coachUserId)
        {
            if (traineeUserId <= 0) throw new ArgumentException("A trainee is required");
            if (!DateTime.TryParse(startDateStr, out var start)) start = DateTime.Today;

            int assignmentId = _dal.AssignProgram(programId, traineeUserId, coachUserId, start.Date);

            // Push the trainee (best-effort) so they know even with the app closed.
            var prog = _dal.GetProgram(programId);
            PushSender.Send(_userDal.GetPushToken(traineeUserId),
                "New training program 📋",
                $"Your coach assigned you \"{prog?.Name ?? "a program"}\". Open TrainWise to see it on your calendar.");

            return assignmentId;
        }

        public List<ProgramAssignment> GetAssignmentsForTrainee(int traineeUserId) => _dal.GetAssignmentsForTrainee(traineeUserId);
        public List<ProgramAssignment> GetAssignmentsForCoach(int coachUserId) => _dal.GetAssignmentsForCoach(coachUserId);
        public ProgramAssignment GetAssignment(int assignmentId) => _dal.GetAssignment(assignmentId);
        public void DeleteAssignment(int assignmentId) => _dal.DeleteAssignment(assignmentId);

        // ── per-assignment chat ──────────────────────────────────────────────────
        // GET also marks the caller's incoming messages seen, so the sender's
        // "seen by N" updates on the next poll (same behaviour as the event chat).
        public List<ProgramMessage> GetMessages(int assignmentId, int userId)
        {
            _dal.MarkSeen(assignmentId, userId);
            return _dal.GetMessages(assignmentId);
        }

        public ProgramMessage PostMessage(int assignmentId, int senderId, string text, string imagePath, string videoPath, string audioPath)
        {
            var t = Trim(text, 1000);
            bool empty = string.IsNullOrWhiteSpace(t)
                && string.IsNullOrEmpty(imagePath)
                && string.IsNullOrEmpty(videoPath)
                && string.IsNullOrEmpty(audioPath);
            if (empty) throw new ArgumentException("Message is empty");
            return _dal.PostMessage(assignmentId, senderId, t, imagePath, videoPath, audioPath);
        }

        public void React(int messageId, int userId, string emoji)
        {
            var e = Trim(emoji, 16);
            if (string.IsNullOrEmpty(e)) throw new ArgumentException("Emoji required");
            _dal.React(messageId, userId, e);
        }

        public List<ProgramMessageReaction> GetReactions(int assignmentId) => _dal.GetReactions(assignmentId);

        // ── helpers ──────────────────────────────────────────────────────────────
        private static int Clamp(int v, int lo, int hi) => v < lo ? lo : (v > hi ? hi : v);
        private static string Trim(string s, int max)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            s = s.Trim();
            return s.Length > max ? s.Substring(0, max) : s;
        }
    }
}
