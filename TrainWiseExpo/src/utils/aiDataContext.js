/**
 * #176 — "Ask my data" context builder. Turns the user's recent ActivityLogs
 * into a compact, grounded text block that gets injected into the AI chat's
 * system prompt, so the assistant can answer questions like "how many workouts
 * last week?" or "am I overtraining?" with the user's REAL numbers.
 *
 * Kept small (a summary, not raw rows) to bound the prompt size. Session load =
 * duration × exertion, matching the rest of the app.
 */
const dayMs = 24 * 60 * 60 * 1000;

const num = (v) => Number(v) || 0;

export const buildDataContext = (logs, activityTypes = []) => {
  const rows = (Array.isArray(logs) ? logs : []).filter((l) => {
    const conf = l.isConfirmed ?? l.IsConfirmed;
    return conf === undefined || conf === null || conf === true || conf === 1;
  });
  if (rows.length === 0) return 'The athlete has no logged workouts yet.';

  const typeName = (id) => {
    const t = (activityTypes || []).find(
      (x) => (x.activityTypeID ?? x.ActivityTypeID) === id
    );
    return t ? (t.typeName ?? t.TypeName) : 'Workout';
  };

  const now = Date.now();
  const parsed = rows.map((l) => {
    const start = l.startTime ?? l.StartTime;
    const t = start ? new Date(String(start).endsWith('Z') || /[+-]\d\d:\d\d$/.test(String(start)) ? start : start + 'Z').getTime() : 0;
    const dur = num(l.duration ?? l.Duration);
    const ex = num(l.exertionLevel ?? l.ExertionLevel);
    const load = num(l.calculatedLoadForSession ?? l.CalculatedLoadForSession) || dur * ex;
    return {
      t,
      dur,
      load,
      dist: num(l.distanceKM ?? l.DistanceKM),
      typeId: l.activityTypeID ?? l.ActivityTypeID,
    };
  });

  const inWindow = (from, to) => parsed.filter((p) => p.t >= from && p.t < to);
  const sum = (arr, k) => arr.reduce((s, p) => s + p[k], 0);

  const last7 = inWindow(now - 7 * dayMs, now + dayMs);
  const prev7 = inWindow(now - 14 * dayMs, now - 7 * dayMs);
  const last28 = inWindow(now - 28 * dayMs, now + dayMs);

  const acute = sum(last7, 'load');
  const chronic = last28.length ? sum(last28, 'load') / 4 : 0;
  const acRatio = chronic > 0 ? acute / chronic : 0;

  // top activities in the last 28 days
  const counts = {};
  last28.forEach((p) => { counts[p.typeId] = (counts[p.typeId] || 0) + 1; });
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, c]) => `${typeName(Number(id))} ×${c}`)
    .join(', ');

  const lines = [
    'ATHLETE TRAINING DATA (use these real numbers when answering):',
    `- Last 7 days: ${last7.length} workouts, total load ${Math.round(acute)}, ${sum(last7, 'dur')} min, ${sum(last7, 'dist').toFixed(1)} km.`,
    `- Previous 7 days: ${prev7.length} workouts, total load ${Math.round(sum(prev7, 'load'))}.`,
    `- Last 28 days: ${last28.length} workouts, total load ${Math.round(sum(last28, 'load'))}.`,
    `- Acute:Chronic workload ratio ≈ ${acRatio.toFixed(2)} (sweet spot 0.8–1.3; >1.3 = spike/injury risk; <0.8 = detraining).`,
    top ? `- Most frequent activities (28d): ${top}.` : null,
    `- All-time logged workouts: ${parsed.length}.`,
  ].filter(Boolean);

  return lines.join('\n');
};
