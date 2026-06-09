import AsyncStorage from '@react-native-async-storage/async-storage';
import { scopedKey } from './activeUser';

// Base keys — namespaced per account via scopedKey() at call time so coins /
// streak don't leak across accounts on the same device.
const LAST_BASE = '@trainwise_last_checkin';
const STREAK_BASE = '@trainwise_streak';
const COINS_BASE = '@trainwise_coins';
const LAST_KEY = () => scopedKey(LAST_BASE);
const STREAK_KEY = () => scopedKey(STREAK_BASE);
const COINS_KEY = () => scopedKey(COINS_BASE);

const toDateOnly = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const daysBetween = (a, b) =>
  Math.round((toDateOnly(b).getTime() - toDateOnly(a).getTime()) / (1000 * 60 * 60 * 24));

export const getStreakEmoji = (streak) => {
  if (streak >= 30) return '🔥🔥🔥';
  if (streak >= 14) return '🔥🔥';
  if (streak >= 7) return '🔥';
  if (streak >= 3) return '⚡';
  return '👋';
};

const rewardForStreak = (streak) => {
  if (streak === 1) return 10;
  if (streak < 7) return 15;
  return 25;
};

/**
 * Idempotent: calling twice on the same calendar day returns the existing
 * state with isNewCheckIn=false and never awards coins twice. Streak
 * increments only when the previous check-in was exactly one calendar day
 * ago; any longer gap resets to a fresh streak of 1.
 */
export const processCheckIn = async () => {
  const [lastRaw, streakRaw, coinsRaw] = await Promise.all([
    AsyncStorage.getItem(LAST_KEY()),
    AsyncStorage.getItem(STREAK_KEY()),
    AsyncStorage.getItem(COINS_KEY()),
  ]);

  let streak = parseInt(streakRaw, 10) || 0;
  let coins = parseInt(coinsRaw, 10) || 0;
  const today = toDateOnly(new Date());
  const lastDate = lastRaw ? toDateOnly(new Date(lastRaw)) : null;

  if (lastDate) {
    const diff = daysBetween(lastDate, today);
    if (diff === 0) {
      return {
        streak,
        coins,
        coinsEarned: 0,
        isNewCheckIn: false,
        streakEmoji: getStreakEmoji(streak),
      };
    }
    streak = diff === 1 ? streak + 1 : 1;
  } else {
    streak = 1;
  }

  const coinsEarned = rewardForStreak(streak);
  coins += coinsEarned;

  await Promise.all([
    AsyncStorage.setItem(LAST_KEY(), today.toISOString()),
    AsyncStorage.setItem(STREAK_KEY(), String(streak)),
    AsyncStorage.setItem(COINS_KEY(), String(coins)),
  ]);

  return {
    streak,
    coins,
    coinsEarned,
    isNewCheckIn: true,
    streakEmoji: getStreakEmoji(streak),
  };
};

export const getCheckInState = async () => {
  const [streakRaw, coinsRaw] = await Promise.all([
    AsyncStorage.getItem(STREAK_KEY()),
    AsyncStorage.getItem(COINS_KEY()),
  ]);
  return {
    streak: parseInt(streakRaw, 10) || 0,
    coins: parseInt(coinsRaw, 10) || 0,
  };
};

// Adds coins to the current account (used for testing the shop). Returns the
// new balance.
export const grantCoins = async (amount) => {
  const coinsRaw = await AsyncStorage.getItem(COINS_KEY());
  const current = parseInt(coinsRaw, 10) || 0;
  const next = current + amount;
  await AsyncStorage.setItem(COINS_KEY(), String(next));
  return next;
};

export const spendCoins = async (amount) => {
  const coinsRaw = await AsyncStorage.getItem(COINS_KEY());
  const current = parseInt(coinsRaw, 10) || 0;
  if (current < amount) return false;
  await AsyncStorage.setItem(COINS_KEY(), String(current - amount));
  return true;
};
