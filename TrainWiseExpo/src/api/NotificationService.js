import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savePushToken } from '../services/api';

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
// Written by AddWorkoutScreen / SyncService after a workout lands, so the
// reminder can skip a day the user already trained (B-3).
const LAST_WORKOUT_DATE_KEY = '@trainwise_last_workout_date';
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

// Item 12 — register this device's NATIVE FCM token with the backend so the
// server (FirebaseAdmin / FCM HTTP v1) can deliver remote notifications even
// when the app is closed (new chat messages, coach-planned workouts).
// Best-effort: on Android this only yields a token when the build has FCM
// configured (google-services.json baked in + the Google Services gradle plugin
// applied). Without that getDevicePushTokenAsync throws and we no-op, leaving
// the in-app foreground notifications working as before.
const PUSH_TOKEN_KEY = '@trainwise_push_token';

export const registerForPushToken = async (userId) => {
  if (!userId) return;
  try {
    if (!Device.isDevice) return;
    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Raw FCM registration token (the backend talks to FCM directly).
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const token = tokenResp?.data;
    if (!token || typeof token !== 'string') return;

    // Only hit the backend when the token (or the signed-in user) changed.
    const cacheKey = `${userId}:${token}`;
    const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (cached === cacheKey) return;

    await savePushToken(userId, token);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, cacheKey);
  } catch (e) {
    // No FCM in this build / offline — remote push simply stays off.
    console.warn('[Notifications] push-token registration skipped:', e.message);
  }
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

// Mark the app as opened today.
export const markAppOpened = async () => {
  try {
    await AsyncStorage.setItem(LAST_OPENED_KEY, new Date().toISOString());
  } catch (e) {
    console.warn('[Notifications] markAppOpened failed:', e.message);
  }
};

// Record that a workout landed (defaults to today) so the daily reminder skips
// that day. Accepts a Date or a YYYY-MM-DD string; stored as a LOCAL date so it
// lines up with the reminder's "today" check. Called from AddWorkoutScreen and
// SyncService.
export const markWorkoutToday = async (date) => {
  try {
    const str = typeof date === 'string' ? date : localDateStr(date || new Date());
    await AsyncStorage.setItem(LAST_WORKOUT_DATE_KEY, str);
  } catch (e) {
    console.warn('[Notifications] markWorkoutToday failed:', e.message);
  }
};

// Local-midnight YYYY-MM-DD (not UTC) so "today" lines up with the user's
// calendar day regardless of timezone.
const localDateStr = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const midnight = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const daysBetween = (fromIso, toDate) => {
  if (!fromIso) return null;
  try {
    return Math.max(0, Math.round((midnight(toDate) - midnight(new Date(fromIso))) / 86400000));
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────
// Reminder copy — 5 escalation tiers, each with 5 randomized bodies (B-3).
// (No em-dashes per project style; commas/periods only.)
// ─────────────────────────────────────────────
const MESSAGES = {
  green: {
    title: "Time for today's session 💪",
    bodies: [
      "You're fresh and ready, let's log a session today! 💪",
      "Green zone! Perfect time to push a little harder. 🚀",
      "Your body is recovered. Don't waste it, train today! 🔥",
      "Fresh legs, full potential. Add a workout now! 🏃",
      "Recovered and raring to go. Today's a great day to move! ⚡",
    ],
  },
  yellow: {
    title: 'Keep the momentum 🔥',
    bodies: [
      "You're building well, keep the pace moderate today. 🟡",
      "Good effort this week! One more solid session keeps it rolling. 💪",
      "Yellow zone, train smart not hard today. 🎯",
      "Steady progress! A moderate workout holds your momentum. 📈",
      "You're in a good rhythm, just keep it controlled. 🧘",
    ],
  },
  nudge1: {
    title: 'Yesterday slipped by, keep the streak 👀',
    bodies: [
      "Your streak is on the line, log a quick session today. 👀",
      "One day off is fine, two is a habit. Train today! 🔁",
      "Don't let yesterday turn into a pattern. Move today! 🏃",
      "A short workout today keeps the momentum alive. ⏱️",
      "Your streak misses you. Even 20 minutes counts! 💪",
    ],
  },
  nudge2: {
    title: 'Your gains are getting cold 🥶',
    bodies: [
      "Two days off. Open TrainWise and log even a short session. 🥶",
      "Cold gains warm up fast, one workout today does it. 🔥",
      "Two days is a blip, not a trend. Get moving today! 🏋️",
      "Your body remembers. A light session restarts the engine. ⚙️",
      "Let's break the two day pause with a quick workout. ✅",
    ],
  },
  nudge3: {
    title: 'TrainWise misses you 😢',
    bodies: [
      "Three plus days away. One workout today resets your momentum. 😢",
      "It's been a while. Today is the perfect day to come back. 🌅",
      "No guilt, just a fresh start. Log a session today! 🌱",
      "Your training is waiting. Ease back in with a light one. 🤝",
      "Welcome back energy starts with one workout. Let's go! 🚀",
    ],
  },
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Picks the message tier from how long the user has been away (computed for the
// DAY THE REMINDER WILL FIRE) and their current load. Suppresses entirely when
// injury risk is high (Red / acRatio > 1.5) so we don't nudge a fatigued user.
const buildReminderContent = (acRatio, loadLevel, daysAwayAtFire) => {
  if (loadLevel === 'Red' || (acRatio && acRatio > 1.5)) return null;

  let tier;
  if (daysAwayAtFire >= 3) tier = 'nudge3';
  else if (daysAwayAtFire === 2) tier = 'nudge2';
  else if (daysAwayAtFire === 1) tier = 'nudge1';
  else tier = loadLevel === 'Yellow' || (acRatio && acRatio >= 1.0) ? 'yellow' : 'green';

  const set = MESSAGES[tier];
  return { title: set.title, body: pick(set.bodies) };
};

// Cancels any pending reminder and schedules a fresh ONE-OFF reminder for the
// next 18:00. Because this is called on every app launch / Home focus / workout,
// it keeps re-arming for the next day, so it stays "daily" for engaged users
// while a future-dated trigger never fires on app open (fixes the instant-fire
// bug). If the user already opened the app OR trained today, the reminder is
// pushed to tomorrow so we don't nag an already-active user.
export const scheduleDailyReminder = async (acRatio = null, loadLevel = 'Green') => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const lastOpenedIso = await AsyncStorage.getItem(LAST_OPENED_KEY);
    const lastWorkout = await AsyncStorage.getItem(LAST_WORKOUT_DATE_KEY);

    const openedToday = daysBetween(lastOpenedIso, now) === 0;
    const workoutToday = lastWorkout === localDateStr(now);

    // Next 18:00 occurrence.
    const fire = new Date(now);
    fire.setHours(DAILY_HOUR, DAILY_MINUTE, 0, 0);
    const past1745 = now.getHours() * 60 + now.getMinutes() >= 17 * 60 + 45;
    if (past1745) fire.setDate(fire.getDate() + 1);

    // Already engaged today → skip today's nudge, aim for tomorrow.
    if ((openedToday || workoutToday) && midnight(fire) === midnight(now)) {
      fire.setDate(fire.getDate() + 1);
    }

    // Tier reflects how stale the user will be WHEN THE REMINDER FIRES.
    const daysAwayAtFire =
      lastOpenedIso != null ? daysBetween(lastOpenedIso, fire) : 0;
    const content = buildReminderContent(acRatio, loadLevel, daysAwayAtFire);
    if (!content) return; // suppressed (injury risk high)

    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        sound: true,
        channelId: 'trainwise',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fire,
      },
    });
  } catch (error) {
    console.warn('[Notifications] Failed to schedule daily reminder:', error.message);
  }
};

// Back-compat shim: older code still imports scheduleWeeklyReminder via App.js.
export const scheduleWeeklyReminder = () => scheduleDailyReminder(null, 'Green');
