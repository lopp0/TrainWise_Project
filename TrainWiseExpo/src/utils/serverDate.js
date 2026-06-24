/**
 * Parse a timestamp that came from the TrainWise backend.
 *
 * SQL `datetime` columns are timezone-naive, so ASP.NET serializes them
 * WITHOUT a 'Z' or offset, e.g. "2026-06-14T09:00:00". The instants we store
 * are UTC (the app posts `Date.toISOString()`), so a bare `new Date(str)`
 * reads them as device-local and the displayed time drifts by the local UTC
 * offset (3 hours in Israel / Asia-Jerusalem). Tagging a zone-less string as
 * UTC before parsing fixes every screen that shows a workout time.
 *
 * Strings that already carry a zone ('Z' or +hh:mm) are passed through
 * unchanged, so this is safe to call on any backend timestamp.
 */
export const parseServerDate = (value) => {
  if (value == null) return new Date(NaN);
  if (value instanceof Date) return value;
  const s = String(value);
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  return new Date(hasZone ? s : s + 'Z');
};
