import { computeLoadAnalytics } from './loadSeries';

/**
 * #183 — Injury-Risk Gauge (Monotony & Strain).
 *
 * Fuses ACWR with Foster's training monotony (weekly mean daily load / its
 * std-dev) and strain (weekly load x monotony) into a single 0-100 score with a
 * green / amber / red band and a plain-language tip. Client-side mirror of the
 * planned ML endpoint so the gauge works on the trainee Load tab even when the
 * local Python service is off. Reuses computeLoadAnalytics so the numbers agree
 * with the rest of the app (same load math, confirmed-only, injured bands).
 *
 * Thresholds from sports-science norms (Gabbett ACWR > 1.3 risky; Foster
 * monotony > 2 risky). Degrades to band:'unknown' with < 3 active days this week.
 */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const computeInjuryRisk = (logs, experienceLevel, hasActiveInjury = false) => {
  // No confirmed workouts at all (e.g. a brand-new account): there is nothing to
  // assess. Without this, the cold-start floor makes ratio 0 (not null), which
  // hits the "detraining" branch and shows a misleading amber ~50. Show the
  // "log a workout first" state instead.
  const confirmedCount = (logs || []).filter((l) => {
    const c = l.isConfirmed ?? l.IsConfirmed;
    return c === undefined || c === null || c === true || c === 1;
  }).length;
  if (confirmedCount === 0) {
    return {
      score: null,
      band: 'unknown',
      ratio: null,
      monotony: 0,
      strain: 0,
      tip: 'Log a workout first — your injury-risk read appears once you have training data.',
    };
  }

  const a = computeLoadAnalytics(logs, experienceLevel, { hasActiveInjury });
  const monotony = a.summary.monotony;              // 0..5 (mean / stdev, last 7 days)
  const strain = a.summary.strain;                  // weekly load x monotony
  const activeDays7 = 7 - a.summary.restDays7;
  const last = a.series[a.series.length - 1] || null;
  const ratio = last?.rollingRatio ?? null;

  // We can give a read as soon as the ACWR is computable (which uses the FULL
  // history via the cold-start floor + chronic window, not just this week). Only
  // when there's no ratio at all is there truly nothing to show.
  if (ratio == null) {
    return {
      score: null,
      band: 'unknown',
      ratio,
      monotony: Math.round(monotony * 100) / 100,
      strain,
      tip: 'Log a workout to get a risk read.',
    };
  }

  // ACWR component 0..1. Sweet-spot 0.8-1.3; above 1.3 climbs fast (a spike
  // >1.5 is the classic danger zone); below 0.8 is a milder detraining risk.
  // The UPPER sweet-spot (1.0-1.3) rises mildly too, so a Yellow-level ratio
  // (≈1.3) never reads a flat 0 risk while the status pill says Yellow.
  let acwrRisk;
  if (ratio > 1.3) acwrRisk = clamp((ratio - 1.3) / 0.4, 0, 1);            // 1.3->0, 1.7->1
  else if (ratio > 1.0) acwrRisk = clamp((ratio - 1.0) / 0.3, 0, 1) * 0.35; // 1.0->0, 1.3->0.35
  else if (ratio < 0.8) acwrRisk = clamp((0.8 - ratio) / 0.6, 0, 0.5);     // mild detraining
  else acwrRisk = 0;

  // Monotony (Foster) is only meaningful with a few training days in the week
  // (with 0-1 active days the mean/stdev is noise) — ignore it below 2 days so
  // it can't distort the score either way.
  const monoValid = activeDays7 >= 2;
  const monoRisk = monoValid ? clamp((monotony - 1.3) / (2.2 - 1.3), 0, 1) : 0; // 1.3->0, 2.2->1

  // Base score: ACWR + monotony blend, or ACWR alone when monotony isn't valid.
  let score = monoValid ? Math.round(acwrRisk * 62 + monoRisk * 38) : Math.round(acwrRisk * 100);

  // Danger conditions RAISE the score (not just the band) so the number and the
  // color always agree — a red gauge never shows a low number.
  if (ratio > 1.5) score = Math.max(score, 80);
  if (hasActiveInjury && ratio >= 1.2) score = Math.max(score, 70);
  if (monoValid && monotony > 2 && ratio > 1.3) score = Math.max(score, 75);
  score = clamp(score, 0, 100);

  // Band derives purely from the score, so they can't contradict.
  const band = score >= 66 ? 'red' : score >= 33 ? 'amber' : 'green';

  let tip;
  if (hasActiveInjury && ratio >= 1.2) tip = `Load is high (ACWR ${ratio.toFixed(2)}) while an injury is active. Ease off to avoid a setback.`;
  else if (monoValid && monotony > 2 && ratio > 1.3) tip = 'High and very repetitive load. Vary intensity and add a rest day.';
  else if (ratio > 1.5) tip = `Load is spiking hard (ACWR ${ratio.toFixed(2)}). Take 1-2 easy days.`;
  else if (ratio > 1.3) tip = `Load is climbing (ACWR ${ratio.toFixed(2)}). Ease off the next day or two.`;
  else if (monoValid && monotony > 2) tip = 'Your training is very repetitive. Mix easy and hard days to lower monotony.';
  else if (ratio < 0.8) tip = 'Load has dropped off. Rebuild gradually to stay sharp.';
  else if (band === 'green') tip = 'Balanced load and variety. Keep it up.';
  else tip = 'Slightly elevated risk. Watch your recovery this week.';

  return { score, band, ratio, monotony: Math.round(monotony * 100) / 100, strain, tip };
};
