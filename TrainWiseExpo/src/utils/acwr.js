import { getWeekStartDate } from '../constants/weekStart';
import { parseServerDate } from './serverDate';

/**
 * Acute:Chronic Workload Ratio — the SAME calculation the trainee's Warnings
 * screen uses (current week acute, 28-day chronic average, cold-start floor).
 * Extracted so the coach dashboard shows the identical number the trainee sees
 * (item 10): the server's stored DailyLoad lacks the cold-start floor, so a
 * sparse-history trainee reads e.g. 1.85 server-side but 0.60 in-app. Computing
 * from the confirmed ActivityLogs here removes that mismatch.
 *
 * 2026-07-06 correctness pass (kept in lockstep with C# LoadCalculationBL and
 * ml/features.py — change one, change all):
 *   - parseServerDate for session times (backend datetimes carry no zone; a
 *     naive new Date() bucketed 00:30 workouts onto the previous day).
 *   - cold-start floor counts days with load > 0 (was: any session day).
 *   - covered-days ramp once >= 7 active days: chronic = sum28 / min(4,
 *     covered/7) — a steady 2-week-old user reads ~1.0, not a false Red 2.0.
 *   - optional hasActiveInjury tightens the bands like the backend
 *     (Red >= 1.2, Yellow 0.8..<1.2).
 */
const BOOTSTRAP_WEEKLY = { 1: 150, 2: 280, 3: 420 }; // Beginner / Regular / Advanced

const determineLevel = (ratio, hasActiveInjury = false) => {
  if (ratio == null || ratio <= 0) return 'Green';
  if (hasActiveInjury) {
    if (ratio >= 1.2) return 'Red';
    if (ratio >= 0.8) return 'Yellow';
    return 'Green';
  }
  if (ratio > 1.3) return 'Red';
  if (ratio >= 0.8) return 'Yellow';
  return 'Green';
};

const sumInRange = (logs, start, end) =>
  logs.reduce((sum, log) => {
    const st = parseServerDate(log.startTime || log.StartTime);
    if (st >= start && st <= end) {
      return sum + Number(log.calculatedLoadForSession ?? log.CalculatedLoadForSession ?? 0);
    }
    return sum;
  }, 0);

export const computeACWR = (logsRaw, experienceLevel, weekOffset = 0, hasActiveInjury = false) => {
  const logs = (logsRaw || []).filter((l) => (l.isConfirmed ?? l.IsConfirmed) !== false);

  // weekOffset shifts the whole acute/chronic window by N weeks (0 = current,
  // -1 = last week) so the same calculation can power a week-over-week delta
  // (#118) without duplicating the load math.
  const weekStart = getWeekStartDate(weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const chronicStart = new Date(weekStart);
  chronicStart.setDate(weekStart.getDate() - 21); // 21 + 7 displayed = 28-day window
  chronicStart.setHours(0, 0, 0, 0);

  const acute = sumInRange(logs, weekStart, weekEnd);
  const chronic28Sum = sumInRange(logs, chronicStart, weekEnd);

  // Per-day loads inside the window: distinct LOADED days drive the floor,
  // and the first loaded day drives the covered-days ramp.
  const dayLoads = new Map();
  logs.forEach((log) => {
    const st = parseServerDate(log.startTime || log.StartTime);
    if (st >= chronicStart && st <= weekEnd) {
      const d = new Date(st);
      d.setHours(0, 0, 0, 0);
      const load = Number(log.calculatedLoadForSession ?? log.CalculatedLoadForSession ?? 0);
      dayLoads.set(d.getTime(), (dayLoads.get(d.getTime()) || 0) + load);
    }
  });
  const activeDayKeys = [...dayLoads.entries()].filter(([, v]) => v > 0).map(([k]) => k);
  const baselineEstablished = activeDayKeys.length >= 7;
  const bootstrap = BOOTSTRAP_WEEKLY[experienceLevel] || 150;

  let effChronic;
  if (!baselineEstablished) {
    effChronic = Math.max(chronic28Sum / 4, bootstrap);
  } else {
    // Covered days run from the first loaded day through the end of the
    // window that data can exist for (today, for the current week).
    const firstActive = Math.min(...activeDayKeys);
    const coverEnd = Math.min(weekEnd.getTime(), Date.now());
    const endDay = new Date(coverEnd);
    endDay.setHours(0, 0, 0, 0);
    const covered = Math.min(
      28,
      Math.max(7, Math.round((endDay.getTime() - firstActive) / 86400000) + 1),
    );
    effChronic = chronic28Sum / Math.min(4, covered / 7);
  }

  let ratio = 0;
  let level = 'Green';
  if (effChronic > 0) {
    ratio = acute / effChronic;
    level = determineLevel(ratio, hasActiveInjury);
  } else if (acute > 0) {
    ratio = acute >= 1000 ? 2.0 : acute >= 300 ? 1.1 : 0.9;
    level = determineLevel(ratio, hasActiveInjury);
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
