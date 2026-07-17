import { parseServerDate } from './serverDate';

/**
 * #165 — Per-activity personal-best dashboard.
 *
 * Computed client-side from confirmed activity logs: longest duration, longest
 * distance, best pace, and the top single-session load PER activity type. Grouped
 * so each activity shows its own records (fastest ride, longest run, etc.).
 */
export const computePersonalBests = (logsRaw, activityTypes = []) => {
  const logs = (logsRaw || []).filter((l) => (l.isConfirmed ?? l.IsConfirmed) !== false);
  const nameById = new Map(
    (activityTypes || []).map((t) => [t.activityTypeID ?? t.ActivityTypeID, t.typeName ?? t.TypeName]),
  );
  const byType = new Map();

  logs.forEach((l) => {
    const typeId = l.activityTypeID ?? l.ActivityTypeID ?? 0;
    const dur = Number(l.duration ?? l.Duration ?? 0);
    const dist = Number(l.distanceKM ?? l.DistanceKM ?? 0);
    const load = Number(l.calculatedLoadForSession ?? l.CalculatedLoadForSession ?? 0);
    const when = parseServerDate(l.startTime || l.StartTime);
    if (!byType.has(typeId)) byType.set(typeId, []);
    byType.get(typeId).push({ dur, dist, load, when, pace: dist > 0 && dur > 0 ? dur / dist : null });
  });

  const result = [];
  byType.forEach((rows, typeId) => {
    const longestDur = rows.reduce((b, r) => (r.dur > (b?.dur ?? -1) ? r : b), null);
    const longestDist = rows.reduce((b, r) => (r.dist > (b?.dist ?? -1) ? r : b), null);
    const bestPace = rows
      .filter((r) => r.pace != null)
      .reduce((b, r) => (r.pace < (b?.pace ?? Infinity) ? r : b), null);
    const topLoad = rows.reduce((b, r) => (r.load > (b?.load ?? -1) ? r : b), null);
    result.push({
      typeId,
      typeName: nameById.get(typeId) || `Activity #${typeId}`,
      sessions: rows.length,
      longestDurationMin: longestDur?.dur || 0,
      longestDistanceKm: Math.round((longestDist?.dist || 0) * 100) / 100,
      bestPaceMinPerKm: bestPace ? Math.round(bestPace.pace * 100) / 100 : null,
      topLoad: topLoad?.load || 0,
    });
  });

  return result.sort((a, b) => b.sessions - a.sessions);
};

/** Format a min/km pace as "m:ss /km", or null when there's no pace. */
export const formatPace = (minPerKm) => {
  if (minPerKm == null) return null;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  const mm = s === 60 ? m + 1 : m;
  const ss = s === 60 ? 0 : s;
  return `${mm}:${String(ss).padStart(2, '0')} /km`;
};
