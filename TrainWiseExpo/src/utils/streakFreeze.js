import AsyncStorage from '@react-native-async-storage/async-storage';
import { scopedKey } from './activeUser';
import { spendCoins } from './checkInManager';

/**
 * #150 — Streak freeze (Duolingo-style). A freeze is a consumable (NOT a
 * cosmetic in shopManager) bought with coins; a missed day is automatically
 * covered by a freeze so the streak survives. Stored per account.
 */
const FREEZE_BASE = '@trainwise_streak_freezes';
const FREEZE_KEY = () => scopedKey(FREEZE_BASE);

export const FREEZE_PRICE = 50;

export const getFreezeCount = async () => {
  const raw = await AsyncStorage.getItem(FREEZE_KEY());
  return parseInt(raw, 10) || 0;
};

const setFreezeCount = async (n) => {
  await AsyncStorage.setItem(FREEZE_KEY(), String(Math.max(0, n)));
  return Math.max(0, n);
};

export const addFreezes = async (n = 1) => {
  const cur = await getFreezeCount();
  return setFreezeCount(cur + n);
};

// Buy one freeze with coins. Returns { success, message, count }.
export const buyFreeze = async () => {
  const paid = await spendCoins(FREEZE_PRICE);
  if (!paid) return { success: false, message: 'Not enough coins for a streak freeze.' };
  const count = await addFreezes(1);
  return { success: true, message: 'Streak freeze added.', count };
};

// Try to consume `n` freezes all-or-nothing (used to cover missed days).
// Returns true if it could cover them (and consumed them), false otherwise.
export const tryConsumeFreezes = async (n) => {
  if (n <= 0) return true;
  const cur = await getFreezeCount();
  if (cur < n) return false;
  await setFreezeCount(cur - n);
  return true;
};
