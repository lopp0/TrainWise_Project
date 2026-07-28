/**
 * Extract a human-readable message from an axios error, whatever shape the
 * backend returned. Handles: a plain string body, ASP.NET model-validation
 * ({ errors: {...} }), the security-layer global handler ({ message }/{ error }),
 * ProblemDetails ({ title }), or a bare network error. Never returns "[object
 * Object]" (the bug this replaces — see CLAUDE.md chat note).
 */
export const errText = (e, fallback = 'Something went wrong.') => {
  const d = e?.response?.data;
  if (typeof d === 'string' && d.trim()) return d;
  if (d && typeof d === 'object') {
    if (d.errors && typeof d.errors === 'object') {
      const first = Object.values(d.errors)[0];
      if (Array.isArray(first) && first[0]) return first[0];
      if (typeof first === 'string') return first;
    }
    if (d.message) return d.message;
    if (d.error) return d.error;
    if (d.title) return d.title;
  }
  if (e?.message) return e.message;
  return fallback;
};

export default errText;
