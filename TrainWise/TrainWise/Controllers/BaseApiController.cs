using System.Linq;
using Microsoft.AspNetCore.Mvc;
using TrainWise.DAL;

namespace TrainWise.Controllers
{
    /// <summary>
    /// Base for controllers that act on a specific user's data. Exposes the
    /// verified caller identity from the JWT and a per-resource ownership check.
    /// </summary>
    public abstract class BaseApiController : ControllerBase
    {
        /// <summary>The authenticated caller's UserID (from the "uid" claim), or null if no valid token was sent.</summary>
        protected int? CallerId
        {
            get
            {
                var raw = User?.FindFirst("uid")?.Value;
                return int.TryParse(raw, out var id) ? id : (int?)null;
            }
        }

        /// <summary>True if the authenticated caller is flagged as a coach.</summary>
        protected bool CallerIsCoach => User?.FindFirst("isCoach")?.Value == "1";

        /// <summary>
        /// Ownership gate that is SAFE to add before enforcement is switched on:
        ///  - No token present (CallerId == null): allowed (legacy tokenless client).
        ///  - Token present and matches the resource owner: allowed.
        ///  - Token present but belongs to a DIFFERENT user: DENIED.
        /// So an updated (token-bearing) client is ownership-checked immediately,
        /// while old builds keep working until AUTH_ENFORCE flips on (which then
        /// blocks tokenless callers globally via the fallback policy).
        /// </summary>
        protected bool CallerMayAct(int resourceUserId) =>
            CallerId == null || CallerId.Value == resourceUserId;

        /// <summary>Same gate for a two-party resource (e.g. a conversation between a and b).</summary>
        protected bool CallerMayActEither(int a, int b) =>
            CallerId == null || CallerId.Value == a || CallerId.Value == b;

        /// <summary>
        /// Gate for data that a trainee owns but their linked COACH may also read
        /// (workouts, calendar, injuries): allowed if the caller is the trainee
        /// themselves OR a coach the trainee is linked to. Allows when no token is
        /// present (pre-enforcement safety), like the other gates.
        /// </summary>
        protected bool CallerOwnsOrCoaches(int traineeUserId)
        {
            if (CallerId == null) return true;
            if (CallerId.Value == traineeUserId) return true;
            try
            {
                // GetCoachesForTrainee returns each coach's Users-row id (CoachUserID).
                return new CoachDAL().GetCoachesForTrainee(traineeUserId)
                    .Any(c => c.CoachUserID == CallerId.Value);
            }
            catch { return false; }
        }

        /// <summary>
        /// True if the authenticated caller owns the coach record identified by
        /// <paramref name="coachId"/> (Coaches.CoachID). Used to gate the coach-only
        /// endpoints that are keyed by CoachID rather than UserID.
        /// </summary>
        protected bool CallerOwnsCoachId(int coachId)
        {
            if (CallerId == null) return true;
            try
            {
                var coach = new CoachDAL().GetCoachByUserId(CallerId.Value);
                return coach != null && coach.CoachID == coachId;
            }
            catch { return false; }
        }
    }
}
