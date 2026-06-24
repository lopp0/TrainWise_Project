import { Colors } from '../theme/colors';
import { getWeekStartDate } from '../constants/weekStart';
import { parseServerDate } from './serverDate';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const getLoadStatus = (load) => {
  if (!load || load <= 0) {
    return { key: 'none', label: 'No workout', color: Colors.textMuted };
  }
  if (load < 150) return { key: 'light', label: 'Light', color: '#00e676' };
  if (load < 300) return { key: 'moderate', label: 'Moderate', color: '#ffee58' };
  if (load < 500) return { key: 'high', label: 'High', color: '#ff9800' };
  return { key: 'veryHigh', label: 'Very high', color: '#f44336' };
};

export const computeWeeklyStats = (weeklyData) => {
  const days = weeklyData || [];
  const trainedDays = days.filter((d) => d.load > 0);
  const totalLoad = days.reduce((sum, d) => sum + (d.load || 0), 0);
  const workoutCount = trainedDays.length;
  const avgLoad = workoutCount > 0 ? Math.round(totalLoad / workoutCount) : 0;

  let peakDay = null;
  let peakLoad = 0;
  days.forEach((d) => {
    if (d.load > peakLoad) {
      peakLoad = d.load;
      peakDay = DAY_LABELS[d.dayIndex];
    }
  });

  return {
    workoutCount,
    totalLoad: Math.round(totalLoad),
    avgLoad,
    peakDay,
    peakLoad: Math.round(peakLoad),
    hasData: totalLoad > 0,
  };
};

export const computeDailyStats = (weeklyData) => {
  if (!weeklyData || weeklyData.length === 0) return null;
  const todayIdx = new Date().getDay();
  const todayEntry = weeklyData.find((d) => d.dayIndex === todayIdx);
  if (!todayEntry) return null;
  const status = getLoadStatus(todayEntry.load);
  return {
    load: todayEntry.load,
    status,
    hasWorkout: todayEntry.load > 0,
  };
};

// ─────────────────────────────────────────────
// B-8 — "This week at a glance" summary, computed entirely client-side from
// the raw confirmed ActivityLogs already fetched by HomeScreen (NO extra API
// call). Counts true SESSIONS (not trained-days like computeWeeklyStats), the
// longest session, most-frequent activity, a workout STREAK across all weeks,
// and the week-over-week load delta.
// ─────────────────────────────────────────────

const logStart = (log) => parseServerDate(log.startTime ?? log.StartTime);
const isConfirmedLog = (log) => (log.isConfirmed ?? log.IsConfirmed) !== false;
const logDuration = (log) => Number(log.duration ?? log.Duration ?? 0);
const logExertion = (log) => Number(log.exertionLevel ?? log.ExertionLevel ?? 5);
const logActivityId = (log) => log.activityTypeID ?? log.ActivityTypeID ?? null;
const logActivityName = (log) =>
  log.typeName ?? log.TypeName ?? log.activityName ?? log.ActivityName ?? null;
const logLoad = (log) => {
  const v = log.calculatedLoadForSession ?? log.CalculatedLoadForSession;
  if (v != null && v !== '') return Number(v);
  return Math.round(logDuration(log) * logExertion(log));
};
const dayKey = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

export const computeWeeklySummary = (logs, activityTypes = []) => {
  const confirmed = (logs || []).filter(isConfirmedLog);
  const weekStart = getWeekStartDate(0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const lastWeekStart = getWeekStartDate(-1);

  const inRange = (log, from, to) => {
    const t = logStart(log).getTime();
    return t >= from.getTime() && t < to.getTime();
  };

  const thisWeek = confirmed.filter((l) => inRange(l, weekStart, weekEnd));
  const lastWeek = confirmed.filter((l) => inRange(l, lastWeekStart, weekStart));

  const totalLoad = thisWeek.reduce((s, l) => s + logLoad(l), 0);
  const lastWeekLoad = lastWeek.reduce((s, l) => s + logLoad(l), 0);

  let longest = null;
  thisWeek.forEach((l) => {
    const dur = logDuration(l);
    if (!longest || dur > longest.duration) {
      longest = { duration: dur, activityTypeId: logActivityId(l), typeName: logActivityName(l) };
    }
  });

  const counts = {};
  thisWeek.forEach((l) => {
    const id = logActivityId(l);
    const key = id != null ? `id:${id}` : `name:${(logActivityName(l) || '').toLowerCase()}`;
    if (!counts[key]) counts[key] = { count: 0, activityTypeId: id, typeName: logActivityName(l) };
    counts[key].count += 1;
  });
  let mostFrequent = null;
  Object.values(counts).forEach((c) => {
    if (!mostFrequent || c.count > mostFrequent.count) mostFrequent = c;
  });

  // Resolve a readable activity name from the type list when the log row
  // didn't carry one.
  const nameFor = (id, fallback) => {
    if (fallback) return fallback;
    const t = (activityTypes || []).find(
      (a) => (a.activityTypeID ?? a.ActivityTypeID) === id
    );
    return t?.typeName ?? t?.TypeName ?? null;
  };
  if (longest) longest.typeName = nameFor(longest.activityTypeId, longest.typeName);
  if (mostFrequent) mostFrequent.typeName = nameFor(mostFrequent.activityTypeId, mostFrequent.typeName);

  // Workout streak: consecutive days (ending today) with >=1 confirmed workout.
  const trainedDays = new Set(confirmed.map((l) => dayKey(logStart(l))));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // If nothing logged today yet, start from yesterday so an active streak
  // isn't shown as 0 before today's session is in.
  if (!trainedDays.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (trainedDays.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const deltaPct =
    lastWeekLoad > 0 ? Math.round(((totalLoad - lastWeekLoad) / lastWeekLoad) * 100) : null;

  return {
    sessions: thisWeek.length,
    totalLoad: Math.round(totalLoad),
    longest,
    mostFrequent,
    streak,
    deltaPct,
    lastWeekLoad: Math.round(lastWeekLoad),
    hasData: thisWeek.length > 0,
  };
};
