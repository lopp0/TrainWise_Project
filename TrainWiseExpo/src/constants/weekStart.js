import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'trainwise.weekStartDay';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_WEEK_START = 0;

let _cachedWeekStart = DEFAULT_WEEK_START;
const _listeners = new Set();

export const initWeekStart = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw == null ? DEFAULT_WEEK_START : Number.parseInt(raw, 10);
    _cachedWeekStart = Number.isFinite(parsed) && parsed >= 0 && parsed <= 6
      ? parsed
      : DEFAULT_WEEK_START;
  } catch {
    _cachedWeekStart = DEFAULT_WEEK_START;
  }
  return _cachedWeekStart;
};

export const getWeekStartDay = () => _cachedWeekStart;

export const setWeekStartDay = async (dayIndex) => {
  const day = Math.max(0, Math.min(6, Number(dayIndex) || 0));
  _cachedWeekStart = day;
  try {
    await AsyncStorage.setItem(KEY, String(day));
  } catch {}
  _listeners.forEach((fn) => fn(day));
  return day;
};

export const subscribeWeekStart = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

/**
 * Returns the most recent week-start anchor (midnight) at or before today,
 * shifted by `offset` whole weeks. Honors the user's configured weekStartDay.
 */
export const getWeekStartDate = (offset = 0, weekStartDay = _cachedWeekStart) => {
  const today = new Date();
  const d = new Date(today);
  const diff = (today.getDay() - weekStartDay + 7) % 7;
  d.setDate(today.getDate() - diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Returns the 7 day-name labels in display order, starting at weekStartDay.
 */
export const getWeekDayLabels = (weekStartDay = _cachedWeekStart) =>
  Array.from({ length: 7 }, (_, i) => DAY_NAMES[(weekStartDay + i) % 7]);
