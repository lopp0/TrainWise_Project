/**
 * Calorie math for the balance ring (#167 / #2c / #2d).
 *
 * All values are DERIVED from the user's live profile (weight/height/age/gender/
 * activity level), so they adapt automatically when the profile changes — nothing
 * is hardcoded.
 */

const round = (n) => Math.round(n); // 0.5 -> up, <0.5 -> down (standard rounding)

const ageFrom = (birthYear) => {
  const y = Number(birthYear);
  if (!y || y < 1900) return 30; // sane fallback
  return Math.max(10, Math.min(100, new Date().getFullYear() - y));
};

// Sedentary=1, light=2, moderate/active=3 -> activity multiplier for TDEE.
const ACTIVITY_FACTOR = { 1: 1.375, 2: 1.55, 3: 1.725 };

/**
 * Mifflin-St Jeor Basal Metabolic Rate (kcal/day). Gender-aware: the constant is
 * +5 for males and −161 for females (the formula genuinely differs by sex).
 */
export const computeBMR = ({ weight, height, birthYear, gender }) => {
  const w = Number(weight);
  const h = Number(height);
  if (!w || !h || w <= 0 || h <= 0) return null; // not enough profile data
  const age = ageFrom(birthYear);
  const isFemale = String(gender || '').toLowerCase().startsWith('f');
  const bmr = 10 * w + 6.25 * h - 5 * age + (isFemale ? -161 : 5);
  return bmr > 0 ? round(bmr) : null;
};

/**
 * Total Daily Energy Expenditure = BMR × activity factor. This is the "Base"
 * budget shown in the ring. Falls back to null when the profile is incomplete
 * (the caller then uses the flat default).
 */
export const computeTDEE = (user) => {
  const bmr = computeBMR(user || {});
  if (bmr == null) return null;
  const factor = ACTIVITY_FACTOR[Number(user?.activityLevel)] || 1.375;
  return round(bmr * factor);
};

/**
 * #2c — estimate calories burned by a workout that has no measured value
 * (manual logs store 0; only Health-Connect imports carry real kcal). MET-based:
 * kcal = MET × weightKg × hours, with MET scaled from the 1-10 exertion level.
 */
export const estimateWorkoutCalories = ({ durationMin, exertion, weightKg }) => {
  const dur = Number(durationMin) || 0;
  const ex = Math.max(1, Math.min(10, Number(exertion) || 5));
  const w = Number(weightKg) > 0 ? Number(weightKg) : 70; // default 70kg
  if (dur <= 0) return 0;
  const met = 1.5 + ex; // exertion 1 -> 2.5 MET (easy) ... 10 -> 11.5 MET (max)
  return round(met * w * (dur / 60));
};
