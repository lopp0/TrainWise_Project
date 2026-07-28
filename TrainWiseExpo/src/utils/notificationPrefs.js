import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Notification preferences + quiet hours (feature #161).
 *
 * Per-type opt-out toggles and an optional do-not-disturb window, persisted in
 * AsyncStorage. `NotificationService` consults `isTypeEnabled` / `isQuietNow`
 * before firing anything, and re-arms the daily reminder / weekly recap based on
 * these. Cached in memory so the notification hot-path doesn't await AsyncStorage
 * on every call.
 */
const KEY = '@trainwise_notif_prefs';

export const NOTIF_DEFAULTS = {
  dailyReminder: true,
  loadWarnings: true,
  messages: true,
  social: true,
  weeklyRecap: true,
  quietHoursEnabled: false,
  quietStart: 22, // 22:00
  quietEnd: 7, // 07:00
};

// Human labels for the Settings UI (key → label).
export const NOTIF_TYPE_LABELS = {
  dailyReminder: 'Daily training reminder',
  loadWarnings: 'Load / injury-risk warnings',
  messages: 'New chat messages',
  social: 'Friends & coaches',
  weeklyRecap: 'Weekly recap',
};

let cache = null;

export async function getNotifPrefs() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? { ...NOTIF_DEFAULTS, ...JSON.parse(raw) } : { ...NOTIF_DEFAULTS };
  } catch {
    cache = { ...NOTIF_DEFAULTS };
  }
  return cache;
}

export async function setNotifPrefs(patch) {
  const current = await getNotifPrefs();
  cache = { ...current, ...patch };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // best-effort; the in-memory cache still reflects the change this session
  }
  return cache;
}

/** True unless the user explicitly turned this notification type off. */
export async function isTypeEnabled(type) {
  if (!type) return true; // untyped/system notifications are never gated
  const p = await getNotifPrefs();
  return p[type] !== false;
}

/** True if "now" falls inside the quiet-hours window (handles wrap past midnight). */
export async function isQuietNow(now = new Date()) {
  const p = await getNotifPrefs();
  if (!p.quietHoursEnabled) return false;
  const h = now.getHours();
  const { quietStart: s, quietEnd: e } = p;
  if (s === e) return false;
  return s < e ? h >= s && h < e : h >= s || h < e;
}
