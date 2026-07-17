import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWeekStartDate } from '../constants/weekStart';
import { parseServerDate } from './serverDate';
import { grantCoins } from './checkInManager';
import { scopedKey } from './activeUser';

/**
 * #148 — Daily / weekly quests.
 *
 * Quests are generated client-side from the user's stats (no backend table). Each
 * has coin rewards; claimed state persists per account per PERIOD (day or week),
 * so a completed quest can be claimed once and the set refreshes each period.
 */
const pad = (n) => String(n).padStart(2, '0');
const dayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekStr = () => dayStr(getWeekStartDate(0));
const claimedKey = () => scopedKey('@trainwise_quests_claimed');

// A claim id is scoped to its period so it auto-resets (daily_log:2026-07-10).
const claimId = (q) => `${q.id}:${q.period === 'daily' ? dayStr() : weekStr()}`;

const getClaimed = async () => {
  try {
    const raw = await AsyncStorage.getItem(claimedKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const saveClaimed = async (obj) => {
  try {
    await AsyncStorage.setItem(claimedKey(), JSON.stringify(obj));
  } catch {
    // best-effort
  }
};

export const buildQuests = (logsRaw) => {
  const logs = (logsRaw || []).filter((l) => (l.isConfirmed ?? l.IsConfirmed) !== false);
  const todayStr = new Date().toDateString();
  const weekStart = getWeekStartDate(0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekLogs = logs.filter((l) => {
    const st = parseServerDate(l.startTime || l.StartTime);
    return st >= weekStart && st <= weekEnd;
  });
  const todayLogs = logs.filter(
    (l) => parseServerDate(l.startTime || l.StartTime).toDateString() === todayStr,
  );

  const weeklyLoad = weekLogs.reduce(
    (s, l) => s + Number(l.calculatedLoadForSession ?? l.CalculatedLoadForSession ?? 0),
    0,
  );
  const distinctActs = new Set(weekLogs.map((l) => l.activityTypeID ?? l.ActivityTypeID)).size;
  const longToday = todayLogs.some((l) => Number(l.duration ?? l.Duration ?? 0) >= 30);

  return [
    { id: 'daily_log', period: 'daily', icon: 'checkmark-done-outline', title: 'Log a workout today', reward: 10, progress: Math.min(todayLogs.length, 1), target: 1 },
    { id: 'daily_30min', period: 'daily', icon: 'time-outline', title: 'A 30+ min session today', reward: 15, progress: longToday ? 1 : 0, target: 1 },
    { id: 'weekly_3', period: 'weekly', icon: 'barbell-outline', title: 'Log 3 workouts this week', reward: 30, progress: Math.min(weekLogs.length, 3), target: 3 },
    { id: 'weekly_load', period: 'weekly', icon: 'flame-outline', title: 'Reach 1000 weekly load', reward: 40, progress: Math.min(Math.round(weeklyLoad), 1000), target: 1000 },
    { id: 'weekly_variety', period: 'weekly', icon: 'shuffle-outline', title: 'Train 3 different activities', reward: 35, progress: Math.min(distinctActs, 3), target: 3 },
  ];
};

/** Quests annotated with complete / claimed / claimable. */
export const getQuestsState = async (logsRaw) => {
  const quests = buildQuests(logsRaw);
  const claimed = await getClaimed();
  return quests.map((q) => {
    const complete = q.progress >= q.target;
    const isClaimed = !!claimed[claimId(q)];
    return { ...q, complete, claimed: isClaimed, claimable: complete && !isClaimed };
  });
};

/** Claim a completed quest once; awards coins and returns the new balance. */
export const claimQuest = async (quest) => {
  const claimed = await getClaimed();
  const id = claimId(quest);
  if (claimed[id]) return { ok: false };
  claimed[id] = true;
  await saveClaimed(claimed);
  const balance = await grantCoins(quest.reward);
  return { ok: true, balance, reward: quest.reward };
};
