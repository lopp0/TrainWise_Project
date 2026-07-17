import { parseServerDate } from './serverDate';

/**
 * Client-side fallback for GET /dailyload/user/{id}/analytics.
 *
 * Mirrors the backend LoadAnalyticsBL exactly (same shape, same camelCase
 * keys) so the trend charts keep working when the installed app talks to a
 * backend that predates the analytics endpoint, or when the request fails.
 * Methods, with sources (same citations as the C# side):
 *   - rolling ACWR: acute = 7-day sum, chronic = 28-day sum / 4 (Gabbett 2016)
 *   - EWMA ACWR: lambda = 2/(N+1) -> 0.25 acute, ~0.069 chronic (Williams 2017)
 *   - monotony/strain: mean/stdev of last 7 daily loads (Foster 1998)
 *   - intensity mix: duration-weighted RPE buckets 1-3 / 4-6 / 7-10 (Seiler ref)
 */

const BOOTSTRAP_WEEKLY = { 1: 150, 2: 280, 3: 420 }; // Beginner / Regular / Advanced
const LAMBDA_ACUTE = 2 / (7 + 1);      // 0.25
const LAMBDA_CHRONIC = 2 / (28 + 1);   // ~0.069
const WARMUP_DAYS = 56;

// Same thresholds as backend DetermineLoadLevel, incl. tighter injured bands.
// Injured Yellow runs to (not incl.) the 1.2 Red line — the old 1.1 cap left a
// gap where an injured user at 1.15 read GREEN (fixed 2026-07-06, both sides).
const determineLevel = (ratio, hasActiveInjury) => {
  if (ratio == null) return 'Green';
  if (hasActiveInjury) {
    if (ratio >= 1.2) return 'Red';
    if (ratio >= 0.8) return 'Yellow';
    return 'Green';
  }
  if (ratio > 1.3) return 'Red';
  if (ratio >= 0.8) return 'Yellow';
  return 'Green';
};

const dayKey = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

export const computeLoadAnalytics = (logsRaw, experienceLevel, options = {}) => {
  const { days = 56, hasActiveInjury = false } = options;
  const logs = (logsRaw || []).filter(
    (l) => (l.isConfirmed ?? l.IsConfirmed) !== false,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));
  const fetchFrom = new Date(from);
  fetchFrom.setDate(from.getDate() - WARMUP_DAYS);

  // Bucket confirmed session loads per calendar day. parseServerDate handles
  // the backend's timezone-naive datetimes (the 3h-drift gotcha).
  const loadByDay = new Map();
  const sessions = [];
  logs.forEach((l) => {
    const st = parseServerDate(l.startTime || l.StartTime);
    const key = dayKey(st);
    const load = Number(l.calculatedLoadForSession ?? l.CalculatedLoadForSession ?? 0);
    loadByDay.set(key, (loadByDay.get(key) || 0) + load);
    sessions.push({
      day: key,
      minutes: Number(l.duration ?? l.Duration ?? 0),
      rpe: Number(l.exertionLevel ?? l.ExertionLevel ?? 0),
    });
  });

  const dayLoad = (d) => loadByDay.get(dayKey(d)) || 0;
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const sumRange = (start, end) => {
    let s = 0;
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) s += dayLoad(d);
    return s;
  };
  const countActiveDays = (start, end) => {
    let n = 0;
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) if (dayLoad(d) > 0) n++;
    return n;
  };
  // Mirrors C# LoadCalculationBL.EffectiveChronic: cold-start floor below 7
  // active days; covered-days ramp after (chronic = sum28 / min(4, covered/7),
  // covered from the first loaded day in the window) so a steady 2-week-old
  // user reads ~1.0 instead of a false Red 2.0. Full histories unchanged.
  const effectiveChronic = (day, bootstrapWeekly) => {
    const windowStart = addDays(day, -27);
    const sum28 = sumRange(windowStart, day);
    if (countActiveDays(windowStart, day) < 7) {
      return Math.max(sum28 / 4, bootstrapWeekly);
    }
    let firstActive = windowStart;
    for (let d = new Date(windowStart); d <= day; d = addDays(d, 1)) {
      if (dayLoad(d) > 0) {
        firstActive = d;
        break;
      }
    }
    const covered =
      Math.round((dayKey(day) - dayKey(firstActive)) / 86400000) + 1; // 7..28
    return sum28 / Math.min(4, covered / 7);
  };

  const bootstrapWeekly = BOOTSTRAP_WEEKLY[experienceLevel] || 150;
  const bootstrapDaily = bootstrapWeekly / 7;

  const series = [];
  let ewmaAcute = 0;
  let ewmaChronic = 0;

  // Bias-corrected EWMA (mirrors LoadAnalyticsBL): a zero-seeded EWMA
  // understates the chronic average early on, which INFLATES the ratio — a
  // new user's first workout would falsely read Red. Dividing by
  // (1 - (1-lambda)^t) removes the zero-initialization bias (the Adam
  // correction, Kingma & Ba 2015); t counts from the first logged session.
  const firstLogKey = loadByDay.size > 0 ? Math.min(...loadByDay.keys()) : null;
  let t = 0;

  for (let d = new Date(fetchFrom); d <= today; d = addDays(d, 1)) {
    const load = dayLoad(d);
    if (firstLogKey != null && dayKey(d) >= firstLogKey) {
      t++;
      ewmaAcute = load * LAMBDA_ACUTE + (1 - LAMBDA_ACUTE) * ewmaAcute;
      ewmaChronic = load * LAMBDA_CHRONIC + (1 - LAMBDA_CHRONIC) * ewmaChronic;
    }
    if (d < from) continue; // EWMA warmup only

    const ewmaAcuteCorr =
      t > 0 ? ewmaAcute / (1 - Math.pow(1 - LAMBDA_ACUTE, t)) : 0;
    const ewmaChronicCorr =
      t > 0 ? ewmaChronic / (1 - Math.pow(1 - LAMBDA_CHRONIC, t)) : 0;

    const acute = sumRange(addDays(d, -6), d);
    const baselineByDay = countActiveDays(addDays(d, -27), d) >= 7;

    const effChronic = effectiveChronic(d, bootstrapWeekly);
    // EWMA needs no ramp: its bias correction already yields the sample mean
    // over a short history (steady training reads ratio 1).
    const effEwmaChronic = baselineByDay
      ? ewmaChronicCorr
      : Math.max(ewmaChronicCorr, bootstrapDaily);

    const rollingRatio = effChronic > 0 ? acute / effChronic : null;
    // No sessions yet (t === 0): no EWMA evidence — chart shows a gap.
    const ewmaRatio =
      t > 0 && effEwmaChronic > 0 ? ewmaAcuteCorr / effEwmaChronic : null;

    series.push({
      date: new Date(d).toISOString(),
      dailyLoad: Math.round(load),
      rollingAcute: Math.round(acute),
      rollingChronic: Math.round(effChronic * 10) / 10,
      rollingRatio,
      rollingLevel: determineLevel(rollingRatio, hasActiveInjury),
      ewmaAcute: Math.round(ewmaAcuteCorr * 10) / 10,
      ewmaChronic: Math.round(effEwmaChronic * 10) / 10,
      ewmaRatio,
      ewmaLevel: determineLevel(ewmaRatio, hasActiveInjury),
    });
  }

  // --- Summary (Foster monotony/strain + intensity mix) -------------------
  const last7 = Array.from({ length: 7 }, (_, i) => dayLoad(addDays(today, -i)));
  const mean = last7.reduce((a, b) => a + b, 0) / 7;
  const stdev = Math.sqrt(
    last7.reduce((a, v) => a + (v - mean) * (v - mean), 0) / 7,
  );
  const weekly = last7.reduce((a, b) => a + b, 0);
  let monotony = stdev > 0 ? mean / stdev : mean > 0 ? 5 : 0;
  monotony = Math.min(monotony, 5);

  const cutoff = dayKey(addDays(today, -27));
  let lowMin = 0;
  let modMin = 0;
  let highMin = 0;
  sessions.forEach((s) => {
    if (s.day < cutoff || s.day > dayKey(today)) return;
    const minutes = Math.max(s.minutes, 0);
    if (s.rpe <= 3) lowMin += minutes;
    else if (s.rpe <= 6) modMin += minutes;
    else highMin += minutes;
  });
  const total = lowMin + modMin + highMin;

  return {
    from: from.toISOString(),
    to: today.toISOString(),
    safeLow: 0.8,
    safeHigh: 1.3,
    overload: 1.5,
    baselineEstablished: countActiveDays(addDays(today, -27), today) >= 7,
    hasActiveInjury,
    series,
    summary: {
      monotony: Math.round(monotony * 100) / 100,
      strain: Math.round(weekly * monotony),
      lowPct: total > 0 ? Math.round((lowMin / total) * 1000) / 10 : 0,
      moderatePct: total > 0 ? Math.round((modMin / total) * 1000) / 10 : 0,
      highPct: total > 0 ? Math.round((highMin / total) * 1000) / 10 : 0,
      activeDays28: countActiveDays(addDays(today, -27), today),
      restDays7: last7.filter((v) => v <= 0).length,
    },
  };
};
