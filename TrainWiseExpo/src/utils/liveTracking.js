import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * #121 — Background GPS for a live workout (Samsung-Health style). Uses
 * expo-location's foreground-service location updates + an expo-task-manager
 * task so the route keeps recording when the screen is off or the app is
 * backgrounded. Incoming locations are appended to an AsyncStorage buffer; the
 * LiveRun screen polls that buffer to draw the live route and, on stop, reads
 * the full set. This survives the app being pushed to the background (the OS
 * shows the persistent "tracking your run" notification while the service runs).
 */
export const LIVE_TASK = 'trainwise-live-run';
const BUF_KEY = '@trainwise_live_points';

// Defined at module scope (required) — runs even when the app is backgrounded.
// Each fire delivers a batch of locations; append them all to the buffer.
TaskManager.defineTask(LIVE_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const locs = data.locations || [];
  if (!locs.length) return;
  try {
    const raw = await AsyncStorage.getItem(BUF_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    for (const l of locs) {
      if (l?.coords) arr.push({ latitude: l.coords.latitude, longitude: l.coords.longitude, t: l.timestamp });
    }
    await AsyncStorage.setItem(BUF_KEY, JSON.stringify(arr));
  } catch { /* buffer write best-effort */ }
});

export const clearLiveBuffer = () => AsyncStorage.removeItem(BUF_KEY).catch(() => {});

export const readLiveBuffer = async () => {
  try {
    const raw = await AsyncStorage.getItem(BUF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Start (or resume) the foreground-service location updates. `clear` wipes the
// buffer for a fresh run; a resume passes clear=false to keep the route so far.
export const startLiveTracking = async ({ clear = true } = {}) => {
  if (clear) await clearLiveBuffer();
  const already = await Location.hasStartedLocationUpdatesAsync(LIVE_TASK).catch(() => false);
  if (already) return true;
  await Location.startLocationUpdatesAsync(LIVE_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 2000,
    distanceInterval: 4,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'TrainWise — tracking your workout',
      notificationBody: 'Recording your GPS route. Tap to return.',
      notificationColor: '#14b8a6',
    },
  });
  return true;
};

export const stopLiveTracking = async () => {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LIVE_TASK);
    if (started) await Location.stopLocationUpdatesAsync(LIVE_TASK);
  } catch { /* already stopped */ }
};
