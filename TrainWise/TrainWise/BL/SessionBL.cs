using TrainWise.BL.Models;
using TrainWise.DAL;

namespace TrainWise.BL
{
    /// <summary>
    /// "Devices &amp; sessions" (2026-07-19). Registers a session per device login,
    /// lists them for the Settings screen, and revokes them so the matching JWT
    /// stops being accepted immediately.
    ///
    /// Session validity is cached in-process for a few seconds so the per-request
    /// check in Program.cs does not become a database round-trip on every single
    /// API call. A revoke clears the cache entry right away, so the effect is
    /// immediate for the revoking user and at most CacheSeconds for the revoked
    /// device.
    /// </summary>
    public class SessionBL
    {
        private readonly SessionDAL _dal = new SessionDAL();

        private const int CacheSeconds = 10;
        private const int TouchSeconds = 60; // refresh "last active" at most this often

        // sessionId -> (isActive, cachedAtUtc)
        private static readonly Dictionary<int, (bool active, DateTime at)> _validity = new();
        private static readonly Dictionary<int, DateTime> _lastTouch = new();
        private static readonly object _lock = new();

        public int CreateSession(int userId, string tokenId, string deviceName, string platform, string appVersion, string ip)
        {
            // Keep the stored strings sane — they are rendered in the UI.
            deviceName = Trim(deviceName, 120);
            platform = Trim(platform, 40);
            appVersion = Trim(appVersion, 30);
            return _dal.CreateSession(userId, tokenId, deviceName, platform, appVersion, Trim(ip, 64));
        }

        private static string Trim(string s, int max)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            s = s.Trim();
            return s.Length > max ? s.Substring(0, max) : s;
        }

        public List<UserSession> GetSessions(int userId, int currentSessionId)
        {
            var list = _dal.GetSessions(userId);
            foreach (var s in list) s.IsCurrent = s.SessionId == currentSessionId;
            return list;
        }

        /// <summary>Per-request gate used by the JWT pipeline. Cached briefly.</summary>
        public bool IsSessionActive(int sessionId)
        {
            if (sessionId <= 0) return true; // legacy token without a "sid" claim
            lock (_lock)
            {
                if (_validity.TryGetValue(sessionId, out var hit) &&
                    (DateTime.UtcNow - hit.at).TotalSeconds < CacheSeconds)
                    return hit.active;
            }

            bool active;
            try { active = _dal.IsSessionActive(sessionId); }
            catch { return true; } // DB hiccup must not lock everyone out

            lock (_lock) { _validity[sessionId] = (active, DateTime.UtcNow); }
            return active;
        }

        /// <summary>Refresh LastSeenAt, throttled so it is not a write per request.</summary>
        public void TouchThrottled(int sessionId)
        {
            if (sessionId <= 0) return;
            lock (_lock)
            {
                if (_lastTouch.TryGetValue(sessionId, out var last) &&
                    (DateTime.UtcNow - last).TotalSeconds < TouchSeconds) return;
                _lastTouch[sessionId] = DateTime.UtcNow;
            }
            try { _dal.Touch(sessionId); } catch { /* best-effort */ }
        }

        public bool Revoke(int userId, int sessionId)
        {
            var affected = _dal.Revoke(userId, sessionId);
            Invalidate(sessionId);
            return affected > 0;
        }

        public int RevokeOthers(int userId, int keepSessionId)
        {
            var affected = _dal.RevokeOthers(userId, keepSessionId);
            // We don't know the individual ids here, so drop the whole cache: it
            // only costs one DB read per active session afterwards.
            lock (_lock) { _validity.Clear(); }
            return affected;
        }

        private static void Invalidate(int sessionId)
        {
            lock (_lock) { _validity[sessionId] = (false, DateTime.UtcNow); }
        }
    }
}
