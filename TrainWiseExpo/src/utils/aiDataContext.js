/**
 * #176 — "Ask my data" context builder. Turns the user's recent ActivityLogs
 * into a compact, grounded text block that gets injected into the AI chat's
 * system prompt, so the assistant can answer questions like "how many workouts
 * last week?" or "am I overtraining?" with the user's REAL numbers.
 *
 * Kept small (a summary, not raw rows) to bound the prompt size. Session load =
 * duration × exertion, matching the rest of the app.
 */
import { computeACWR } from './acwr';
import { computeWeeklySummary } from './weeklyStats';

const dayMs = 24 * 60 * 60 * 1000;

const num = (v) => Number(v) || 0;

export const buildDataContext = (logs, activityTypes = [], experienceLevel = 1) => {
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
  const last28 = inWindow(now - 28 * dayMs, now + dayMs);

  // THIS WEEK numbers come from the SAME computeWeeklySummary the "This week at a
  // glance" card renders (calendar week, Sun-Sat), so the AI recap can never
  // contradict the card the user is looking at (previously the rolling-7-day
  // window reported 4 workouts / 540 load while the card showed 1 / 180).
  const summary = computeWeeklySummary(logs, activityTypes, experienceLevel);

  // AC ratio + acute/chronic from computeACWR (rolling + cold-start floor +
  // covered-days ramp) — the same number the card and Load tab show.
  const acwr = computeACWR(rows, experienceLevel);
  const acRatio = acwr.ratio;

  // top activities in the last 28 days
  const counts = {};
  last28.forEach((p) => { counts[p.typeId] = (counts[p.typeId] || 0) + 1; });
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, c]) => `${typeName(Number(id))} x${c}`)
    .join(', ');

  const lines = [
    'ATHLETE TRAINING DATA - use ONLY these real numbers; never invent or inflate figures:',
    `- THIS WEEK (matches the app card "This week at a glance"): ${summary.sessions} workout${summary.sessions === 1 ? '' : 's'}, total load ${summary.totalLoad}.`,
    summary.longest ? `- Longest session this week: ${summary.longest.typeName || 'session'}, ${summary.longest.duration} min.` : null,
    summary.mostFrequent ? `- Most-done this week: ${summary.mostFrequent.typeName || 'activity'} x${summary.mostFrequent.count}.` : null,
    `- Current day streak: ${summary.streak}.`,
    `- Last 28 days (BACKGROUND CONTEXT only, do NOT call this "this week"): ${last28.length} workouts, total load ${Math.round(sum(last28, 'load'))}.`,
    `- Acute:Chronic workload ratio = ${acRatio.toFixed(2)} (acute ${acwr.acute}, chronic ${acwr.chronic}; sweet spot 0.8 to 1.3; above 1.3 spike/injury risk; below 0.8 detraining).`,
    top ? `- Most frequent activities (last 28 days): ${top}.` : null,
    `- All-time logged workouts: ${parsed.length}.`,
  ].filter(Boolean);

  return lines.join('\n');
};
