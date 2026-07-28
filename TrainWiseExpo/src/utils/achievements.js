import AsyncStorage from '@react-native-async-storage/async-storage';
import { scopedKey } from './activeUser';
import { findBadgeDef } from './badges';

/**
 * #147 — Tiered achievements. Groups the existing badge keys (computed +
 * awarded by the backend RecordsBL) into Bronze → Silver → Gold/Platinum
 * tracks, so the user sees structured progression instead of a flat grid.
 * No backend change: it reads the earned badge set already returned by
 * GET /records/{id} and layers tiers on top.
 */
export const TIER_META = {
  Bronze: { color: '#CD7F32', order: 1 },
  Silver: { color: '#9FB7C6', order: 2 },
  Gold: { color: '#FFD700', order: 3 },
  Platinum: { color: '#7FFFD4', order: 4 },
};

export const ACHIEVEMENT_TRACKS = [
  {
    key: 'streak',
    label: 'Consistency',
    icon: 'flame',
    tiers: [
      { badgeKey: 'streak_3', tier: 'Bronze' },
      { badgeKey: 'streak_7', tier: 'Silver' },
      { badgeKey: 'streak_30', tier: 'Gold' },
    ],
  },
  {
    key: 'distance',
    label: 'Distance',
    icon: 'navigate',
    tiers: [
      { badgeKey: 'distance_5k', tier: 'Bronze' },
      { badgeKey: 'distance_10k', tier: 'Silver' },
      { badgeKey: 'distance_21k', tier: 'Gold' },
      { badgeKey: 'distance_42k', tier: 'Platinum' },
    ],
  },
  {
    key: 'load',
    label: 'Training Load',
    icon: 'barbell',
    tiers: [
      { badgeKey: 'load_bronze', tier: 'Bronze' },
      { badgeKey: 'load_silver', tier: 'Silver' },
      { badgeKey: 'load_gold', tier: 'Gold' },
    ],
  },
  {
    key: 'sessions',
    label: 'Volume',
    icon: 'fitness',
    tiers: [
      { badgeKey: 'sessions_10', tier: 'Bronze' },
      { badgeKey: 'sessions_50', tier: 'Silver' },
      { badgeKey: 'sessions_100', tier: 'Gold' },
    ],
  },
  {
    key: 'duration',
    label: 'Endurance',
    icon: 'time',
    tiers: [
      { badgeKey: 'duration_60', tier: 'Bronze' },
      { badgeKey: 'duration_120', tier: 'Gold' },
    ],
  },
];

// Build the display model for a track from the set of earned badge keys.
export const buildTrack = (track, earnedSet) => {
  const tiers = track.tiers.map((t) => ({
    ...t,
    ...findBadgeDef(t.badgeKey),
    earned: earnedSet.has(t.badgeKey),
    color: TIER_META[t.tier]?.color,
  }));
  // Highest earned tier = the track's current level.
  const earnedTiers = tiers.filter((t) => t.earned);
  const current = earnedTiers.length ? earnedTiers[earnedTiers.length - 1] : null;
  const next = tiers.find((t) => !t.earned) || null;
  return { ...track, tiers, current, next, earnedCount: earnedTiers.length };
};

// Per-account record of which badges the user has already SEEN, so the
// Achievements screen can pop a celebration only for freshly-unlocked ones.
const SEEN_BASE = '@trainwise_seen_achievements';
const SEEN_KEY = () => scopedKey(SEEN_BASE);

export const getSeenAchievements = async () => {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY());
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

export const markAchievementsSeen = async (keys) => {
  try {
    await AsyncStorage.setItem(SEEN_KEY(), JSON.stringify([...keys]));
  } catch {}
};
