/**
 * #122 — Heart-rate zone breakdown.
 *
 * Buckets HR samples into 5 zones by % of max HR. Max HR is 220 - age (age from
 * the user's birthYear). Works from raw HC HeartRate samples (time-in-zone) and
 * degrades to a single "average zone" indicator when only avgHeartRate is known.
 */
export const ZONE_DEFS = [
  { key: 'z1', label: 'Z1 Recovery', min: 0.5, max: 0.6, color: '#4fc3f7' },
  { key: 'z2', label: 'Z2 Endurance', min: 0.6, max: 0.7, color: '#00e676' },
  { key: 'z3', label: 'Z3 Tempo', min: 0.7, max: 0.8, color: '#ffee58' },
  { key: 'z4', label: 'Z4 Threshold', min: 0.8, max: 0.9, color: '#ff9800' },
  { key: 'z5', label: 'Z5 Max', min: 0.9, max: 1.01, color: '#f44336' },
];

/** 220 - age. Returns null when we can't derive an age. */
export const maxHrForAge = (age) => (age && age > 0 && age < 120 ? 220 - age : null);

export const ageFromBirthYear = (birthYear) => {
  const by = Number(birthYear);
  if (!by || by < 1900) return null;
  const age = new Date().getFullYear() - by;
  return age > 0 && age < 120 ? age : null;
};

const bpmOf = (s) =>
  typeof s === 'number' ? s : Number(s?.bpm ?? s?.beatsPerMinute ?? s?.value ?? 0);

/**
 * @param {Array} samples - array of bpm numbers or { bpm } objects
 * @param {number} maxHr
 * @returns per-zone { ...zone, count, pct } array, or null if unusable
 */
export const computeZones = (samples, maxHr) => {
  if (!maxHr || !Array.isArray(samples) || !samples.length) return null;
  const counts = ZONE_DEFS.map(() => 0);
  let total = 0;
  samples.forEach((s) => {
    const bpm = bpmOf(s);
    if (!bpm || bpm <= 0) return;
    const frac = bpm / maxHr;
    let idx = ZONE_DEFS.findIndex((z) => frac >= z.min && frac < z.max);
    if (idx === -1) idx = frac >= 0.9 ? 4 : 0; // clamp below-Z1 / above-Z5
    counts[idx] += 1;
    total += 1;
  });
  if (!total) return null;
  return ZONE_DEFS.map((z, i) => ({ ...z, count: counts[i], pct: Math.round((counts[i] / total) * 100) }));
};

/** The single zone an average BPM falls into (fallback when no samples). */
export const zoneForBpm = (bpm, maxHr) => {
  if (!bpm || !maxHr) return null;
  const frac = bpm / maxHr;
  return ZONE_DEFS.find((z) => frac >= z.min && frac < z.max) || (frac >= 0.9 ? ZONE_DEFS[4] : ZONE_DEFS[0]);
};
