import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Tracks the last time the user actively opened the app so the daily
// reminder can escalate its tone Duolingo-style when ignored.
const LAST_OPENED_KEY = '@trainwise_last_opened';
const DAILY_HOUR = 18; // 6pm — late enough that most users have finished work
const DAILY_MINUTE = 0;

export const requestNotificationPermission = async () => {
  if (!Device.isDevice) {
    console.warn('[Notifications] Not a real device - skipping permission');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trainwise', {
      name: 'TrainWise Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ff2d6f',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const sendLocalNotification = async (title, body) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        channelId: 'trainwise',
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('[Notifications] Failed to send:', error.message);
  }
};

export const sendLoadWarningIfNeeded = async (acRatio, loadLevel) => {
  if (!acRatio) return;

  if (loadLevel === 'Red' || acRatio > 1.5) {
    await sendLocalNotification(
      'TrainWise - High Load Alert',
      `Your AC Ratio is ${acRatio.toFixed(2)}. Your body needs rest. Consider skipping training today.`
    );
  } else if (loadLevel === 'Yellow' || (acRatio > 1.3 && acRatio <= 1.5)) {
    await sendLocalNotification(
      'TrainWise - Load Monitor',
      `AC Ratio: ${acRatio.toFixed(2)}. Your training load is increasing. Monitor fatigue carefully.`
    );
  }
};

// Mark the app as opened today. Call this when the app launches and on
// each Home focus, so the escalation logic knows the user is engaged.
export const markAppOpened = async () => {
  try {
    await AsyncStorage.setItem(LAST_OPENED_KEY, new Date().toISOString());
  } catch (e) {
    // Non-fatal — escalation will just default to the highest tier if the
    // timestamp can't be read later, which is the safe direction.
    console.warn('[Notifications] markAppOpened failed:', e.message);
  }
};

// Returns the number of full calendar days since the user last opened the
// app. 0 = opened today, 1 = yesterday, etc. Null means we've never seen
// them open it (fresh install) — caller can treat as "engaged" to avoid
// scaring a first-time user.
const daysSinceLastOpened = async () => {
  try {
    const iso = await AsyncStorage.getItem(LAST_OPENED_KEY);
    if (!iso) return null;
    const last = new Date(iso);
    const now = new Date();
    const lastMidnight = new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.max(0, Math.round((todayMidnight - lastMidnight) / 86400000));
  } catch {
    return null;
  }
};

// Picks the reminder body based on the user's current training load AND
// how long it's been since they opened the app. Suppresses the reminder
// entirely when injury risk is high (Red / acRatio > 1.5) so we don't
// nudge a fatigued user into training.
//
// Returns { title, body } or null to suppress.
const buildDailyReminderContent = (acRatio, loadLevel, daysAway) => {
  // Hard safety gate: never push someone into a workout when their body
  // is already over the spike threshold. The Warnings dashboard handles
  // that case with its own messaging.
  if (loadLevel === 'Red' || (acRatio && acRatio > 1.5)) {
    return null;
  }

  // Duolingo-style escalation tiers. Day 0 = friendly nudge, day 1 = mild
  // guilt, day 2+ = direct & punchy. Phrasing stays positive — we're
  // building a habit, not shaming the user.
  const tier = daysAway == null ? 0 : Math.min(daysAway, 3);

  // Load-aware suffix: tells the user what kind of session is appropriate
  // given their AC ratio so they don't have to open the Warnings screen
  // first. Yellow zone = keep it moderate. Green = anything goes.
  let loadHint;
  if (loadLevel === 'Yellow' || (acRatio && acRatio >= 1.0)) {
    loadHint = 'Keep it moderate today — a steady session keeps you in the sweet spot.';
  } else {
    loadHint = "You're fresh — a good day to push or add a new workout.";
  }

  const tiers = [
    {
      title: 'Time for today\'s session 💪',
      body: `Keep your streak alive. ${loadHint}`,
    },
    {
      title: 'Yesterday slipped by — let\'s not make it two 👀',
      body: `Your streak is on the line. ${loadHint}`,
    },
    {
      title: 'Your gains are getting cold 🥶',
      body: `Two days off. Open TrainWise and log even a short session. ${loadHint}`,
    },
    {
      title: 'Where did you go? TrainWise misses you 😢',
      body: `Three+ days away. One workout today resets your momentum. ${loadHint}`,
    },
  ];

  return tiers[tier];
};

// Cancels any existing daily reminder and schedules a fresh one for
// ${DAILY_HOUR}:${DAILY_MINUTE} today (or tomorrow if that's already
// passed). Call this on app launch and after every workout / load
// recalculation so the next notification reflects the latest state.
//
// `acRatio` / `loadLevel` are the user's current values from the Warnings
// dashboard. Pass null / 'Green' if unknown — we'll send a neutral nudge.
export const scheduleDailyReminder = async (acRatio = null, loadLevel = 'Green') => {
  try {
    // Cancel everything we previously scheduled so we don't stack stale
    // bodies on top of new ones. The only thing we schedule is the daily
    // reminder, so a blanket cancel is safe here.
    await Notifications.cancelAllScheduledNotificationsAsync();

    const daysAway = await daysSinceLastOpened();
    const content = buildDailyReminderContent(acRatio, loadLevel, daysAway);
    if (!content) {
      // Suppressed (injury risk high). Don't reschedule — the next launch
      // will try again with fresh load data.
      return;
    }

    // expo-notifications DAILY trigger fires at the same wall-clock time
    // every day. Works while the app is backgrounded; iOS limits the body
    // to the last-scheduled version, so we re-schedule on every app open.
    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        sound: true,
        channelId: 'trainwise',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: DAILY_HOUR,
        minute: DAILY_MINUTE,
      },
    });
  } catch (error) {
    console.warn('[Notifications] Failed to schedule daily reminder:', error.message);
  }
};

// Back-compat shim: older code still imports scheduleWeeklyReminder via
// App.js. Routes the call to the new daily flow with a neutral load so
// existing call sites don't break before they get migrated.
export const scheduleWeeklyReminder = () => scheduleDailyReminder(null, 'Green');
