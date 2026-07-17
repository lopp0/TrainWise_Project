/**
 * #129 / #130 — daily readiness / recovery score.
 *
 * Blends four signals into a 0-100 score (higher = more ready to train hard):
 *   • Sleep last night (hours)            — #129, the primary driver
 *   • Resting HR vs 14-day baseline (bpm) — #130, elevated = fatigue
 *   • HRV (RMSSD) vs 14-day baseline (ms) — #130, low = fatigue
 *   • Acute:Chronic workload ratio        — high load = accumulated fatigue
 *
 * Only the signals that are actually available contribute (a user with just
 * sleep still gets a meaningful score). Returns null when NOTHING is available
 * so the card can show a "connect Health Connect" prompt instead of a fake 100.
 *
 * Thresholds are starting sports-science heuristics, not medical advice.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const computeRecovery = ({ sleepHours, restingHr, hrv, acRatio } = {}) => {
  let score = 100;
  const factors = [];
  let have = false;

  // ── Sleep (#129) ──
  if (typeof sleepHours === 'number' && sleepHours > 0) {
    have = true;
    let penalty = 0;
    if (sleepHours < 7) penalty = (7 - sleepHours) * 8;      // each hour under 7 costs ~8
    else if (sleepHours > 9.5) penalty = (sleepHours - 9.5) * 4; // oversleep, mild
    penalty = clamp(penalty, 0, 45);
    score -= penalty;
    factors.push({
      key: 'sleep',
      icon: 'moon',
      label: 'Sleep',
      value: `${sleepHours.toFixed(1)}h`,
      status: sleepHours >= 7 ? 'good' : sleepHours >= 5.5 ? 'warn' : 'bad',
    });
  }

  // ── Resting HR (#130) ── elevated vs baseline = fatigue
  if (restingHr?.latest > 0 && restingHr?.baseline > 0) {
    have = true;
    const ratio = restingHr.latest / restingHr.baseline;
    const penalty = ratio > 1.03 ? clamp((ratio - 1) * 100 * 1.5, 0, 22) : 0;
    score -= penalty;
    factors.push({
      key: 'rhr',
      icon: 'heart',
      label: 'Rest HR',
      value: `${Math.round(restingHr.latest)}`,
      status: ratio <= 1.03 ? 'good' : ratio <= 1.08 ? 'warn' : 'bad',
    });
  }

  // ── HRV (#130) ── low vs baseline = fatigue
  if (hrv?.latest > 0 && hrv?.baseline > 0) {
    have = true;
    const ratio = hrv.latest / hrv.baseline;
    const penalty = ratio < 0.9 ? clamp((1 - ratio) * 100 * 1.0, 0, 22) : 0;
    score -= penalty;
    factors.push({
      key: 'hrv',
      icon: 'pulse',
      label: 'HRV',
      value: `${Math.round(hrv.latest)}ms`,
      status: ratio >= 0.9 ? 'good' : ratio >= 0.8 ? 'warn' : 'bad',
    });
  }

  // ── ACWR ── high acute load = accumulated fatigue (not a null-blocker)
  if (typeof acRatio === 'number' && acRatio > 0) {
    const penalty = acRatio > 1.3 ? clamp((acRatio - 1.3) * 40, 0, 20) : 0;
    score -= penalty;
    factors.push({
      key: 'acwr',
      icon: 'trending-up',
      label: 'Load',
      value: acRatio.toFixed(2),
      status: acRatio <= 1.3 ? 'good' : acRatio <= 1.5 ? 'warn' : 'bad',
    });
  }

  if (!have) return null; // no wearable signals at all

  score = Math.round(clamp(score, 0, 100));
  const band =
    score >= 75 ? 'ready' : score >= 50 ? 'moderate' : 'fatigued';
  const label =
    band === 'ready' ? 'Ready' : band === 'moderate' ? 'Moderate' : 'Fatigued';

  // Message keyed off the weakest signal.
  const worst = factors
    .filter((f) => f.status !== 'good')
    .sort((a, b) => (a.status === 'bad' ? -1 : 1))[0];
  let message;
  if (band === 'ready') {
    message = 'Recovered and ready — a good day for a harder session.';
  } else if (worst?.key === 'sleep') {
    message = 'Short on sleep — keep today easy and prioritise rest.';
  } else if (worst?.key === 'rhr') {
    message = 'Resting heart rate is up — your body is still recovering.';
  } else if (worst?.key === 'hrv') {
    message = 'HRV is below baseline — go easy and let your system recover.';
  } else if (worst?.key === 'acwr') {
    message = 'Training load is high — consider a lighter session.';
  } else {
    message = band === 'moderate'
      ? 'Moderately recovered — train, but hold something back.'
      : 'Low recovery — rest or keep it very light today.';
  }

  return { score, band, label, message, factors };
};
