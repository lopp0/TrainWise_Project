import { getWeekStartDate } from '../constants/weekStart';

/**
 * Acute:Chronic Workload Ratio — the SAME calculation the trainee's Warnings
 * screen uses (current week acute, 28-day chronic average, cold-start floor).
 * Extracted so the coach dashboard shows the identical number the trainee sees
 * (item 10): the server's stored DailyLoad lacks the cold-start floor, so a
 * sparse-history trainee reads e.g. 1.85 server-side but 0.60 in-app. Computing
 * from the confirmed ActivityLogs here removes that mismatch.
 */
const BOOTSTRAP_WEEKLY = { 1: 150, 2: 280, 3: 420 }; // Beginner / Regular / Advanced

const determineLevel = (ratio) => {
  if (ratio == null || ratio <= 0) return 'Green';
  if (ratio > 1.3) return 'Red';
  if (ratio >= 0.8) return 'Yellow';
  return 'Green';
};

const sumInRange = (logs, start, end) =>
  logs.reduce((sum, log) => {
    const st = new Date(log.startTime || log.StartTime);
    if (st >= start && st <= end) {
      return sum + Number(log.calculatedLoadForSession ?? log.CalculatedLoadForSession ?? 0);
    }
    return sum;
  }, 0);

export const computeACWR = (logsRaw, experienceLevel) => {
  const logs = (logsRaw || []).filter((l) => (l.isConfirmed ?? l.IsConfirmed) !== false);

  const weekStart = getWeekStartDate(0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const chronicStart = new Date(weekStart);
  chronicStart.setDate(weekStart.getDate() - 21); // 21 + 7 displayed = 28-day window
  chronicStart.setHours(0, 0, 0, 0);

  const acute = sumInRange(logs, weekStart, weekEnd);
  const chronic = sumInRange(logs, chronicStart, weekEnd) / 4;

  const distinctDays = new Set();
  logs.forEach((log) => {
    const st = new Date(log.startTime || log.StartTime);
    if (st >= chronicStart && st <= weekEnd) {
      const d = new Date(st);
      d.setHours(0, 0, 0, 0);
      distinctDays.add(d.getTime());
    }
  });
  const baselineEstablished = distinctDays.size >= 7;
  const bootstrap = BOOTSTRAP_WEEKLY[experienceLevel] || 150;
  const effChronic = baselineEstablished ? chronic : Math.max(chronic, bootstrap);

  let ratio = 0;
  let level = 'Green';
  if (effChronic > 0) {
    ratio = acute / effChronic;
    level = determineLevel(ratio);
  } else if (acute > 0) {
    ratio = acute >= 1000 ? 2.0 : acute >= 300 ? 1.1 : 0.9;
    level = determineLevel(ratio);
  }

  // Stress 0-100 (same scale as the trainee's Warnings screen).
  let stress = 0;
  if (effChronic > 0) {
    stress = Math.max(0, Math.min(100, Math.round((acute / effChronic) * 50)));
  } else if (acute > 0) {
    stress = Math.max(0, Math.min(100, Math.round(acute / 20)));
  }

  return { acute: Math.round(acute), chronic: Math.round(effChronic), ratio, level, stress };
};
