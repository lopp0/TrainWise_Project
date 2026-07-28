// Maps the backend's ExperienceLevel (tinyint 1/2/3) to a display label.
// Mirrors the SignUp training-level picker (Beginner / Regular / Advanced).
export const experienceLabel = (lvl) => {
  const n = Number(lvl);
  if (n >= 3) return 'Advanced';
  if (n === 2) return 'Regular';
  if (n === 1) return 'Beginner';
  return 'Athlete';
};

// "last seen" relative text from an ISO/SQL timestamp (server omits the 'Z').
export const lastSeenText = (raw, isOnline) => {
  if (isOnline) return 'Online now';
  if (!raw) return 'Offline';
  try {
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `Active ${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `Active ${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `Active ${d}d ago`;
  } catch {
    return 'Offline';
  }
};
