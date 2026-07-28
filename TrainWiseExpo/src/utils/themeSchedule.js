import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * #179 — Scheduled theme (auto dark in the evening).
 *
 * A simple fixed-hour schedule (no GPS sunset lookup needed, which keeps it
 * working offline and avoids a location prompt): the app switches to the dark
 * theme between `darkStart` and `darkEnd`, and to light outside that window.
 * The window wraps midnight when darkStart > darkEnd (the usual 19:00 → 07:00).
 *
 * Persisted in AsyncStorage with an in-memory cache (mirrors notificationPrefs).
 */
const KEY = '@trainwise_theme_schedule';

export const THEME_SCHEDULE_DEFAULTS = {
  enabled: false,
  darkStart: 19, // 19:00 — go dark
  darkEnd: 7, // 07:00 — back to light
};

let cache = null;

export const getThemeSchedule = async () => {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw
      ? { ...THEME_SCHEDULE_DEFAULTS, ...JSON.parse(raw) }
      : { ...THEME_SCHEDULE_DEFAULTS };
  } catch {
    cache = { ...THEME_SCHEDULE_DEFAULTS };
  }
  return cache;
};

export const setThemeSchedule = async (patch) => {
  const cur = await getThemeSchedule();
  cache = { ...cur, ...patch };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  return cache;
};

/**
 * Which theme the schedule wants right now ('dark' | 'light'). Handles the
 * midnight-wrapping window. If darkStart === darkEnd the window is empty (light).
 */
export const scheduledTheme = (sched, now = new Date()) => {
  const h = now.getHours();
  const { darkStart, darkEnd } = sched;
  let isDark;
  if (darkStart === darkEnd) isDark = false;
  else if (darkStart < darkEnd) isDark = h >= darkStart && h < darkEnd;
  else isDark = h >= darkStart || h < darkEnd; // wraps midnight (e.g. 19→7)
  return isDark ? 'dark' : 'light';
};
