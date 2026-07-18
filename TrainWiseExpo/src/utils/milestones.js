import AsyncStorage from '@react-native-async-storage/async-storage';
import { scopedKey } from './activeUser';

/**
 * #173 — milestone celebrations. Detects when a cumulative stat first crosses a
 * milestone threshold and returns the freshly-hit milestone (once) so the Home
 * screen can fire confetti. Celebrated milestones are remembered per account so
 * each fires exactly once.
 */
const SEEN_BASE = '@trainwise_celebrated_milestones';
const SEEN_KEY = () => scopedKey(SEEN_BASE);

const MILESTONES = [
  { key: 'sessions_10', metric: 'sessions', value: 10, label: '10 workouts logged! 🎉' },
  { key: 'sessions_25', metric: 'sessions', value: 25, label: '25 workouts! Keep it up 💪' },
  { key: 'sessions_50', metric: 'sessions', value: 50, label: '50 workouts — half a century! 🏅' },
  { key: 'sessions_100', metric: 'sessions', value: 100, label: '100 workouts! Legend 🏆' },
  { key: 'distance_100', metric: 'distance', value: 100, label: '100 km covered! 🏃' },
  { key: 'distance_250', metric: 'distance', value: 250, label: '250 km milestone! 🔥' },
  { key: 'distance_500', metric: 'distance', value: 500, label: '500 km! Unstoppable 🚀' },
  { key: 'load_10000', metric: 'load', value: 10000, label: '10,000 lifetime load 💥' },
  { key: 'load_50000', metric: 'load', value: 50000, label: '50,000 lifetime load 🤯' },
];

const getSeen = async () => {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY());
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

const addSeen = async (seen, key) => {
  seen.add(key);
  try {
    await AsyncStorage.setItem(SEEN_KEY(), JSON.stringify([...seen]));
  } catch {}
};

/**
 * @param {{ sessions:number, distance:number, load:number }} totals
 * @returns the first newly-crossed milestone (and records it), or null.
 */
export const checkMilestones = async (totals) => {
  const seen = await getSeen();
  for (const m of MILESTONES) {
    if (seen.has(m.key)) continue;
    if ((totals[m.metric] || 0) >= m.value) {
      await addSeen(seen, m.key);
      return m;
    }
  }
  return null;
};

// Compute the cumulative totals from confirmed activity logs.
export const totalsFromLogs = (logs) => {
  const confirmed = (logs || []).filter((l) => (l.isConfirmed ?? l.IsConfirmed) !== false);
  let sessions = 0;
  let distance = 0;
  let load = 0;
  confirmed.forEach((l) => {
    sessions += 1;
    distance += Number(l.distanceKM ?? l.DistanceKM ?? 0) || 0;
    load += Number(l.calculatedLoadForSession ?? l.CalculatedLoadForSession ?? 0) || 0;
  });
  return { sessions, distance, load };
};
