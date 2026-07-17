import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * #167 — Daily calorie-balance ring.
 *
 * A lightweight local food-intake log. The full nutrition feature (#132) isn't
 * built, so the user quick-logs calories eaten today and the Home ring shows the
 * MyFitnessPal-style budget: Base goal + Exercise burned − Food eaten = Remaining.
 *
 * Intake is stored PER ACCOUNT, PER CALENDAR DAY (so a new day starts fresh); the
 * goal is a single editable per-account target. Values are clamped to sane ranges.
 */
const pad = (n) => String(n).padStart(2, '0');
export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const intakeKey = (userId, day) => `@trainwise_cal_intake_${userId}_${day}`;
const goalKey = (userId) => `@trainwise_cal_goal_${userId}`;

export const DEFAULT_CALORIE_GOAL = 2200;
const GOAL_MIN = 800;
const GOAL_MAX = 6000;
const INTAKE_MAX = 20000; // absurd upper bound so a fat-fingered entry can't overflow the ring

const clampGoal = (g) => Math.max(GOAL_MIN, Math.min(GOAL_MAX, Math.round(g) || DEFAULT_CALORIE_GOAL));
const clampIntake = (v) => Math.max(0, Math.min(INTAKE_MAX, Math.round(v) || 0));

export const getCalorieGoal = async (userId) => {
  if (!userId) return DEFAULT_CALORIE_GOAL;
  try {
    const raw = await AsyncStorage.getItem(goalKey(userId));
    const n = raw != null ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_CALORIE_GOAL;
  } catch {
    return DEFAULT_CALORIE_GOAL;
  }
};

// #2d — returns the user's MANUAL goal override, or null when they've never set
// one. When null, the caller uses the BMR/TDEE computed from the live profile so
// the Base adapts to weight/height/age changes automatically.
export const getStoredCalorieGoal = async (userId) => {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(goalKey(userId));
    const n = raw != null ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

export const setCalorieGoal = async (userId, goal) => {
  const g = clampGoal(goal);
  if (!userId) return g;
  try {
    await AsyncStorage.setItem(goalKey(userId), String(g));
  } catch {
    // best-effort — the caller's in-state value still reflects the change
  }
  return g;
};

export const getIntakeToday = async (userId, day = todayKey()) => {
  if (!userId) return 0;
  try {
    const raw = await AsyncStorage.getItem(intakeKey(userId, day));
    const n = raw != null ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
};

const writeIntake = async (userId, value, day = todayKey()) => {
  const v = clampIntake(value);
  try {
    await AsyncStorage.setItem(intakeKey(userId, day), String(v));
  } catch {
    // best-effort
  }
  return v;
};

/** Add `kcal` to today's running total; returns the new total. */
export const addIntake = async (userId, kcal, day = todayKey()) => {
  if (!userId) return 0;
  const cur = await getIntakeToday(userId, day);
  return writeIntake(userId, cur + (Number(kcal) || 0), day);
};

/**
 * Set today's intake to an ABSOLUTE value; returns the clamped value. Used by the
 * server-backed nutrition logger (#132) to keep the Home ring (#167) in sync with
 * the authoritative day total from the backend.
 */
export const setIntakeToday = async (userId, kcal, day = todayKey()) => {
  if (!userId) return 0;
  return writeIntake(userId, kcal, day);
};

/** Clear today's intake back to 0; returns 0. */
export const resetIntakeToday = async (userId, day = todayKey()) => {
  if (!userId) return 0;
  return writeIntake(userId, 0, day);
};
