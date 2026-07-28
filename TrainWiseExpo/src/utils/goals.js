import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWeekStartDate } from '../constants/weekStart';
import { parseServerDate } from './serverDate';

/**
 * #180 — Goal setting & tracking.
 *
 * One active weekly goal per account, stored locally. Progress is computed from
 * THIS week's confirmed logs so the ring fills as workouts are logged; completion
 * is celebrated (#173 confetti reuse on Home).
 */
const KEY = (userId) => `@trainwise_goal_${userId}`;

export const GOAL_TYPES = {
  weekly_load: { label: 'Weekly load', unit: '', defaultTarget: 500, step: 50, min: 100, floor: 300 },
  weekly_workouts: { label: 'Workouts / week', unit: '', defaultTarget: 3, step: 1, min: 1, floor: 3 },
  weekly_distance: { label: 'Weekly distance', unit: 'km', defaultTarget: 10, step: 1, min: 1, floor: 5 },
  weekly_minutes: { label: 'Active minutes / week', unit: 'min', defaultTarget: 120, step: 15, min: 15, floor: 90 },
};

// Suggest a coherent target from the user's RECENT training (last 28 days,
// averaged to a week and nudged +10%), floored at a modest achievable minimum so
// a near-inactive user still gets a sensible goal instead of a scary 1500.
export const suggestTarget = (type, logsRaw) => {
  const meta = GOAL_TYPES[type];
  if (!meta) return 0;
  const logs = (logsRaw || []).filter((l) => (l.isConfirmed ?? l.IsConfirmed) !== false);
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 27);
  from.setHours(0, 0, 0, 0);

  let load = 0;
  let workouts = 0;
  let dist = 0;
  let mins = 0;
  logs.forEach((l) => {
    const t = parseServerDate(l.startTime || l.StartTime);
    if (t < from || t > now) return;
    load += Number(l.calculatedLoadForSession ?? l.CalculatedLoadForSession ?? 0);
    workouts += 1;
    dist += Number(l.distanceKM ?? l.DistanceKM ?? 0);
    mins += Number(l.duration ?? l.Duration ?? 0);
  });

  const perWeek = { weekly_load: load, weekly_workouts: workouts, weekly_distance: dist, weekly_minutes: mins }[type] / 4;
  const nudged = perWeek * 1.1;
  const raw = Math.max(nudged, meta.floor);
  const rounded = Math.max(meta.min, Math.round(raw / meta.step) * meta.step);
  return rounded;
};

export const getGoal = async (userId) => {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    if (!raw) return null;
    const g = JSON.parse(raw);
    return g && GOAL_TYPES[g.type] ? g : null;
  } catch {
    return null;
  }
};

export const setGoal = async (userId, goal) => {
  if (!userId || !goal || !GOAL_TYPES[goal.type]) return;
  const meta = GOAL_TYPES[goal.type];
  const target = Math.max(meta.min, Math.round(Number(goal.target) || meta.defaultTarget));
  try {
    await AsyncStorage.setItem(KEY(userId), JSON.stringify({ type: goal.type, target }));
  } catch {
    // best-effort
  }
};

export const clearGoal = async (userId) => {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(KEY(userId));
  } catch {
    // best-effort
  }
};

/** Current-week progress toward a goal, computed from confirmed logs. */
export const computeGoalProgress = (goal, logsRaw) => {
  if (!goal || !GOAL_TYPES[goal.type]) return null;
  const logs = (logsRaw || []).filter((l) => (l.isConfirmed ?? l.IsConfirmed) !== false);
  const weekStart = getWeekStartDate(0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  let value = 0;
  logs.forEach((l) => {
    const st = parseServerDate(l.startTime || l.StartTime);
    if (st < weekStart || st > weekEnd) return;
    if (goal.type === 'weekly_load') value += Number(l.calculatedLoadForSession ?? l.CalculatedLoadForSession ?? 0);
    else if (goal.type === 'weekly_workouts') value += 1;
    else if (goal.type === 'weekly_distance') value += Number(l.distanceKM ?? l.DistanceKM ?? 0);
    else if (goal.type === 'weekly_minutes') value += Number(l.duration ?? l.Duration ?? 0);
  });
  value = Math.round(value * 10) / 10;
  const meta = GOAL_TYPES[goal.type];
  const target = Number(goal.target) || meta.defaultTarget;
  const fraction = target > 0 ? Math.min(1, value / target) : 0;
  return { value, target, fraction, complete: value >= target, meta };
};
