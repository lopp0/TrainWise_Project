// A-5 — client-side catalog that maps backend badgeKeys / record metricTypes to
// display labels + Ionicons glyphs (all standard Ionicons, so no missing-glyph
// risk). The backend only stores keys/values; the visuals live here.

export const BADGE_DEFS = [
  { key: 'first_workout',  label: 'First Workout',  icon: 'flag',              hint: 'Log your first workout' },
  { key: 'streak_3',       label: '3-Day Streak',   icon: 'flame',             hint: 'Train 3 days in a row' },
  { key: 'streak_7',       label: '7-Day Streak',   icon: 'flame',             hint: 'Train 7 days in a row' },
  { key: 'streak_30',      label: '30-Day Streak',  icon: 'flame',             hint: 'Train 30 days in a row' },
  { key: 'distance_5k',    label: '5K',             icon: 'walk',              hint: 'Cover 5 km in one session' },
  { key: 'distance_10k',   label: '10K',            icon: 'walk',              hint: 'Cover 10 km in one session' },
  { key: 'distance_21k',   label: 'Half Marathon',  icon: 'medal',             hint: 'Cover 21 km in one session' },
  { key: 'distance_42k',   label: 'Marathon',       icon: 'trophy',            hint: 'Cover 42 km in one session' },
  { key: 'duration_60',    label: '60 Minutes',     icon: 'time',              hint: 'Train for 60 minutes straight' },
  { key: 'duration_120',   label: '120 Minutes',    icon: 'time',              hint: 'Train for 120 minutes straight' },
  { key: 'load_bronze',    label: 'Bronze Load',    icon: 'barbell',           hint: '1,000 lifetime load' },
  { key: 'load_silver',    label: 'Silver Load',    icon: 'barbell',           hint: '5,000 lifetime load' },
  { key: 'load_gold',      label: 'Gold Load',      icon: 'barbell',           hint: '20,000 lifetime load' },
  { key: 'sessions_10',    label: '10 Sessions',    icon: 'fitness',           hint: 'Log 10 workouts' },
  { key: 'sessions_50',    label: '50 Sessions',    icon: 'fitness',           hint: 'Log 50 workouts' },
  { key: 'sessions_100',   label: '100 Sessions',   icon: 'ribbon',            hint: 'Log 100 workouts' },
  { key: 'first_pr',       label: 'Record Breaker', icon: 'trending-up',       hint: 'Beat one of your records' },
  { key: 'injury_free_30', label: 'Injury Free',    icon: 'shield-checkmark',  hint: '30 days with no new injury' },
];

export const findBadgeDef = (key) =>
  BADGE_DEFS.find((b) => b.key === key) || { key, label: key, icon: 'star', hint: '' };

export const METRIC_DEFS = {
  longest_distance_km:  { label: 'Longest Distance', icon: 'navigate', fmt: (v) => `${Number(v).toFixed(1)} km` },
  longest_duration_min: { label: 'Longest Session',  icon: 'time',     fmt: (v) => `${Math.round(v)} min` },
  highest_load:         { label: 'Highest Load',     icon: 'pulse',    fmt: (v) => `${Math.round(v)}` },
  most_weekly_sessions: { label: 'Most / Week',      icon: 'calendar', fmt: (v) => `${Math.round(v)}` },
  longest_streak_days:  { label: 'Longest Streak',   icon: 'flame',    fmt: (v) => `${Math.round(v)} days` },
};

export const METRIC_ORDER = [
  'longest_distance_km',
  'longest_duration_min',
  'highest_load',
  'most_weekly_sessions',
  'longest_streak_days',
];
