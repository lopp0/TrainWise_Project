/**
 * smartWorkout — turns the current multi-factor weather snapshot + the user's
 * training load into a workout suggestion AND a factor-by-factor breakdown the
 * Add-Workout "Smart suggestion" card renders (temperature, humidity, UV, wind,
 * air quality, rain). Activity names match the DB ActivityTypes seed so the
 * chips map straight onto a real type.
 */

const INDOOR = ['Gym', 'HIIT', 'Yoga', 'Pilates', 'Spin Class', 'Rowing', 'CrossFit', 'Treadmill Run'];
const OUTDOOR = ['Running', 'Cycling', 'Hiking', 'Trail Running', 'Walking'];
const RECOVERY = ['Walking', 'Yoga', 'Pilates'];

// weatherCondition.type strings that mean "don't train outside".
const WET = /(RAIN|SNOW|THUNDER|STORM|SLEET|HAIL|DRIZZLE|FLURR)/;

// status → traffic-light meaning for the factor tiles.
// 'good' green · 'warn' yellow · 'bad' red.

// Each scorer returns { status, penalty, value, label, icon } or null when the
// underlying datum is missing (so the tile simply hides).
const scoreTemp = (feelsLike, temp) => {
  const t = feelsLike ?? temp;
  if (t == null) return null;
  let status = 'good';
  let penalty = 0;
  if (t >= 38 || t <= 0) { status = 'bad'; penalty = 45; }
  else if (t >= 32 || t <= 5) { status = 'bad'; penalty = 30; }
  else if (t >= 28 || t <= 9) { status = 'warn'; penalty = 15; }
  else { status = 'good'; penalty = 0; } // ~10–27°C sweet spot
  return { key: 'temp', label: 'Feels like', icon: 'thermometer-outline', value: `${Math.round(t)}°`, status, penalty };
};

const scoreHumidity = (h) => {
  if (h == null) return null;
  let status = 'good';
  let penalty = 0;
  if (h >= 85) { status = 'bad'; penalty = 22; }
  else if (h >= 70) { status = 'warn'; penalty = 12; }
  else if (h >= 60) { status = 'warn'; penalty = 6; }
  return { key: 'humidity', label: 'Humidity', icon: 'water-outline', value: `${Math.round(h)}%`, status, penalty };
};

const scoreUv = (uv) => {
  if (uv == null) return null;
  let status = 'good';
  let penalty = 0;
  if (uv >= 8) { status = 'bad'; penalty = 22; }
  else if (uv >= 6) { status = 'warn'; penalty = 12; }
  else if (uv >= 3) { status = 'warn'; penalty = 5; }
  return { key: 'uv', label: 'UV index', icon: 'sunny-outline', value: `${Math.round(uv)}`, status, penalty };
};

const scoreWind = (kph) => {
  if (kph == null) return null;
  let status = 'good';
  let penalty = 0;
  if (kph >= 40) { status = 'bad'; penalty = 25; }
  else if (kph >= 30) { status = 'warn'; penalty = 14; }
  else if (kph >= 22) { status = 'warn'; penalty = 6; }
  return { key: 'wind', label: 'Wind', icon: 'navigate-outline', value: `${Math.round(kph)} km/h`, status, penalty };
};

// Universal AQI: 0–100, HIGHER = cleaner air.
const scoreAir = (aqi, category) => {
  if (aqi == null) return null;
  let status = 'good';
  let penalty = 0;
  if (aqi < 30) { status = 'bad'; penalty = 30; }
  else if (aqi < 50) { status = 'warn'; penalty = 16; }
  else if (aqi < 70) { status = 'warn'; penalty = 6; }
  return {
    key: 'air',
    label: 'Air',
    icon: 'leaf-outline',
    value: category ? category.split(' ')[0] : `${Math.round(aqi)}`,
    status,
    penalty,
  };
};

const scoreRain = (conditionType, precipProb) => {
  const type = String(conditionType || '').toUpperCase();
  const wet = WET.test(type);
  const p = precipProb;
  if (!wet && p == null) return null;
  let status = 'good';
  let penalty = 0;
  if (wet) { status = 'bad'; penalty = 40; }
  else if (p != null && p >= 60) { status = 'bad'; penalty = 28; }
  else if (p != null && p >= 35) { status = 'warn'; penalty = 12; }
  else if (p != null && p >= 15) { status = 'warn'; penalty = 4; }
  return {
    key: 'rain',
    label: 'Rain',
    icon: 'rainy-outline',
    value: wet ? 'Now' : `${Math.round(p)}%`,
    status,
    penalty,
  };
};

/**
 * Scores how good outdoor conditions are right now (0–100) and returns the
 * per-factor breakdown for the card.
 */
export const scoreConditions = (weather) => {
  if (!weather) return null;
  const factors = [
    scoreTemp(weather.feelsLikeC, weather.tempC),
    scoreHumidity(weather.humidity),
    scoreUv(weather.uvIndex),
    scoreWind(weather.windKph),
    scoreAir(weather.aqi, weather.aqiCategory),
    scoreRain(weather.conditionType, weather.precipProb),
  ].filter(Boolean);

  const totalPenalty = factors.reduce((s, f) => s + f.penalty, 0);
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));

  let level;
  if (score >= 75) level = 'great';
  else if (score >= 55) level = 'good';
  else if (score >= 35) level = 'fair';
  else level = 'poor';

  return { score, level, factors };
};

const LEVEL_META = {
  great: { emoji: '🌟', label: 'Great', faceColor: 'good' },
  good: { emoji: '🙂', label: 'Good', faceColor: 'good' },
  fair: { emoji: '😐', label: 'Fair', faceColor: 'warn' },
  poor: { emoji: '☹️', label: 'Poor', faceColor: 'bad' },
};

/**
 * @param {object|null} weather  multi-factor snapshot from weatherService
 * @param {number|null} acRatio  latest AC ratio (overrides weather when high)
 * @returns suggestion object consumed by the Smart-suggestion card, or null.
 */
export const buildSmartSuggestion = ({ weather, acRatio }) => {
  // High training load overrides the weather — push recovery regardless.
  if (acRatio != null && acRatio > 1.3) {
    return {
      kind: 'recovery',
      title: 'Take it easy today',
      emoji: '🧘',
      rating: { emoji: '🧘', label: 'Recovery', faceColor: 'warn' },
      reason: `Your training load is high (AC ${Number(acRatio).toFixed(2)}). A light recovery session lowers injury risk.`,
      score: null,
      factors: weather ? (scoreConditions(weather)?.factors || []) : [],
      activities: RECOVERY,
      indoorPreferred: false,
    };
  }

  if (!weather) return null;

  const cond = scoreConditions(weather);
  const meta = LEVEL_META[cond.level];
  const t = weather.feelsLikeC ?? weather.tempC;
  const type = String(weather.conditionType || '').toUpperCase();
  const wet = WET.test(type) || (weather.precipProb != null && weather.precipProb >= 60);
  const cold = t != null && t <= 5;
  const hot = t != null && t >= 32;

  // Pick the activity set + headline from the dominant constraint, but keep
  // the overall rating from the multi-factor score.
  let title, reason, activities, indoorPreferred;
  if (wet) {
    title = 'Better indoors';
    reason = 'Wet weather. An indoor session keeps you on track.';
    activities = INDOOR;
    indoorPreferred = true;
  } else if (cold) {
    title = 'Stay warm';
    reason = `Feels like ${Math.round(t)}°. Train indoors or warm up thoroughly first.`;
    activities = INDOOR;
    indoorPreferred = true;
  } else if (hot) {
    title = 'Beat the heat';
    reason = `Feels like ${Math.round(t)}°. Swim or keep it light, and hydrate well.`;
    activities = ['Swimming', ...RECOVERY];
    indoorPreferred = false;
  } else if (cond.level === 'poor' || cond.level === 'fair') {
    // No single blocker, but the combined factors (UV + humidity + wind + air)
    // make outdoors unpleasant — nudge indoor.
    const worst = cond.factors.filter((f) => f.status === 'bad').map((f) => f.label.toLowerCase());
    title = 'Tough day outside';
    reason = worst.length
      ? `High ${worst.join(' & ')} right now. Indoors is the smart call.`
      : 'Conditions are middling. Indoors is the safer call.';
    activities = INDOOR;
    indoorPreferred = true;
  } else {
    title = 'Great day to get outside';
    reason = 'Conditions look good. Perfect for an outdoor session.';
    activities = OUTDOOR;
    indoorPreferred = false;
  }

  return {
    kind: 'weather',
    title,
    emoji: meta.emoji,
    rating: { emoji: meta.emoji, label: meta.label, faceColor: meta.faceColor },
    reason,
    score: cond.score,
    factors: cond.factors,
    activities,
    indoorPreferred,
  };
};

export default { buildSmartSuggestion, scoreConditions };
