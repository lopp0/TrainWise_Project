import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'trainwise.hcDeletedKeys';

let _cache = new Set();
let _loaded = false;

/**
 * Normalizes a workout's startTime into a stable key. Backend SQL drops the
 * trailing Z and the seconds drift slightly between HC and the saved row, so
 * we compare at minute granularity, matching SyncService.areWorkoutsDuplicate.
 */
export const tombstoneKeyFor = (workout) => {
  const t = workout?.startTime || workout?.StartTime || '';
  return String(t).replace(/Z$/, '').slice(0, 16);
};

const persist = async () => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(_cache)));
  } catch {}
};

export const loadHcTombstones = async () => {
  if (_loaded) return _cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) _cache = new Set(arr);
    }
  } catch {}
  _loaded = true;
  return _cache;
};

export const isTombstoned = (workout) => {
  const key = tombstoneKeyFor(workout);
  return key !== '' && _cache.has(key);
};

export const tombstoneWorkout = async (workout) => {
  const key = tombstoneKeyFor(workout);
  if (!key) return;
  _cache.add(key);
  await persist();
};

export const clearHcTombstones = async () => {
  _cache = new Set();
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
};
