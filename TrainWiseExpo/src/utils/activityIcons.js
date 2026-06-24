// Maps each seeded ActivityType (IDs 1-20, see CLAUDE.md reference data) to a
// MaterialCommunityIcons glyph + an identity color. Used by the home Add-Workout
// cards (B-2), AddWorkoutScreen, WorkoutSummaryScreen and Stats rows (B-6).
//
// IMPORTANT: every glyph name below was verified to EXIST in the installed
// @expo/vector-icons MaterialCommunityIcons set. A name that doesn't exist
// renders blank (or crashes on some versions), so don't add one without
// checking node_modules/.../glyphmaps/MaterialCommunityIcons.json first.
// The colors are decorative identity tints (not the semantic load traffic
// lights) and read fine on both the dark and light card backgrounds.

export const ACTIVITY_ICONS = {
  1:  { name: 'run',            color: '#00e676' }, // Running
  2:  { name: 'walk',           color: '#69f0ae' }, // Walking
  3:  { name: 'bike',           color: '#40c4ff' }, // Cycling
  4:  { name: 'dumbbell',       color: '#ff6d00' }, // Gym
  5:  { name: 'lightning-bolt', color: '#ff1744' }, // HIIT
  6:  { name: 'swim',           color: '#00b0ff' }, // Swimming
  7:  { name: 'terrain',        color: '#8d6e63' }, // Trail Running
  8:  { name: 'hiking',         color: '#a5d6a7' }, // Hiking
  9:  { name: 'yoga',           color: '#ce93d8' }, // Yoga
  10: { name: 'human-handsup',  color: '#f48fb1' }, // Pilates
  11: { name: 'rowing',         color: '#80deea' }, // Rowing
  12: { name: 'weight-lifter',  color: '#ef5350' }, // CrossFit
  13: { name: 'ellipse-outline', color: '#4db6ac' }, // Elliptical
  14: { name: 'bicycle',        color: '#ffb74d' }, // Spin Class
  15: { name: 'walk',           color: '#81c784' }, // Nordic Walking
  16: { name: 'shoe-print',     color: '#ffd54f' }, // Brisk Walk
  17: { name: 'shoe-sneaker',   color: '#b39ddb' }, // Treadmill Run (no 'treadmill' glyph)
  18: { name: 'weight',         color: '#ff8a65' }, // Powerlifting
  19: { name: 'timer',          color: '#4dd0e1' }, // Interval Run
  20: { name: 'stairs',         color: '#bcaaa4' }, // Stair Climb
};

// Secondary lookup by lowercased type name for activity types whose ID isn't in
// the seed range (e.g. teammate/legacy names in ACTIVITY_FIELDS).
const NAME_ICONS = {
  running: ACTIVITY_ICONS[1],
  walking: ACTIVITY_ICONS[2],
  cycling: ACTIVITY_ICONS[3],
  gym: ACTIVITY_ICONS[4],
  weightlifting: ACTIVITY_ICONS[18],
  powerlifting: ACTIVITY_ICONS[18],
  hiit: ACTIVITY_ICONS[5],
  swimming: ACTIVITY_ICONS[6],
  crossfit: ACTIVITY_ICONS[12],
  yoga: ACTIVITY_ICONS[9],
  pilates: ACTIVITY_ICONS[10],
  boxing: { name: 'boxing-glove', color: '#ef5350' },
  basketball: { name: 'basketball', color: '#ff9800' },
  football: { name: 'soccer', color: '#66bb6a' },
  tennis: { name: 'tennis', color: '#cddc39' },
  rowing: ACTIVITY_ICONS[11],
  hiking: ACTIVITY_ICONS[8],
};

// Safe generic fallback — a real glyph, so a render never breaks.
export const FALLBACK_ACTIVITY_ICON = { name: 'dumbbell', color: '#9aa0b5' };

export const getActivityIcon = (activityTypeId, typeName) => {
  if (activityTypeId != null && ACTIVITY_ICONS[activityTypeId]) {
    return ACTIVITY_ICONS[activityTypeId];
  }
  const byName = NAME_ICONS[(typeName || '').trim().toLowerCase()];
  return byName || FALLBACK_ACTIVITY_ICON;
};
