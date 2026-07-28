/**
 * #164 — Exercise library / catalog (bundled, offline).
 *
 * A browsable REFERENCE of individual exercises (how to do them) — distinct from
 * the 20 loggable activity TYPES (Running, Gym, Yoga...), which are whole-session
 * categories. Each exercise is tagged with the `activity` type it fits under, so
 * the catalog connects to the app's vocabulary. Filtered by muscle group,
 * searched by name. `icon` is an Ionicons name (lightweight stand-in for a GIF).
 */
export const MUSCLE_GROUPS = [
  'All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Mobility',
];

export const EXERCISES = [
  // Chest
  { id: 'pushup', name: 'Push-up', muscle: 'Chest', activity: 'Gym', equipment: 'Bodyweight', icon: 'body-outline', instructions: 'Hands under shoulders, body in a straight line. Lower until elbows ~90 degrees, press back up. Keep the core braced.' },
  { id: 'bench_press', name: 'Bench Press', muscle: 'Chest', activity: 'Powerlifting', equipment: 'Barbell', icon: 'barbell-outline', instructions: 'Lie flat, grip just wider than shoulders. Lower the bar to mid-chest, press up without bouncing. Keep shoulder blades pinched.' },
  { id: 'incline_db_press', name: 'Incline Dumbbell Press', muscle: 'Chest', activity: 'Gym', equipment: 'Dumbbell', icon: 'barbell-outline', instructions: 'Set the bench to ~30 degrees. Press dumbbells up and slightly together, lower under control to chest level.' },
  { id: 'chest_fly', name: 'Cable / Dumbbell Fly', muscle: 'Chest', activity: 'Gym', equipment: 'Cable', icon: 'git-merge-outline', instructions: 'Slight elbow bend, open arms wide, then squeeze the chest to bring hands together. Control the stretch.' },

  // Back
  { id: 'pullup', name: 'Pull-up', muscle: 'Back', activity: 'Gym', equipment: 'Bodyweight', icon: 'body-outline', instructions: 'Hang with an overhand grip. Pull the chest toward the bar, lead with the elbows, lower fully under control.' },
  { id: 'bent_row', name: 'Bent-over Row', muscle: 'Back', activity: 'Gym', equipment: 'Barbell', icon: 'barbell-outline', instructions: 'Hinge at the hips, flat back. Row the bar to the lower ribs, squeeze the shoulder blades, lower slowly.' },
  { id: 'lat_pulldown', name: 'Lat Pulldown', muscle: 'Back', activity: 'Gym', equipment: 'Cable', icon: 'git-merge-outline', instructions: 'Pull the bar to the upper chest, drive elbows down and back. Avoid leaning back excessively.' },
  { id: 'deadlift', name: 'Deadlift', muscle: 'Back', activity: 'Powerlifting', equipment: 'Barbell', icon: 'barbell-outline', instructions: 'Bar over mid-foot, flat back, brace. Drive through the floor, standing tall. Keep the bar close to the body.' },

  // Legs
  { id: 'squat', name: 'Back Squat', muscle: 'Legs', activity: 'Powerlifting', equipment: 'Barbell', icon: 'barbell-outline', instructions: 'Bar on upper back, feet shoulder-width. Sit down and back to at least parallel, drive up through mid-foot.' },
  { id: 'goblet_squat', name: 'Goblet Squat', muscle: 'Legs', activity: 'Gym', equipment: 'Dumbbell', icon: 'barbell-outline', instructions: 'Hold a dumbbell at the chest. Squat between the knees keeping the torso upright, then stand.' },
  { id: 'lunge', name: 'Walking Lunge', muscle: 'Legs', activity: 'Gym', equipment: 'Bodyweight', icon: 'walk-outline', instructions: 'Step forward, lower the back knee toward the floor, push through the front heel to the next step.' },
  { id: 'rdl', name: 'Romanian Deadlift', muscle: 'Legs', activity: 'Gym', equipment: 'Barbell', icon: 'barbell-outline', instructions: 'Soft knees, hinge at the hips pushing them back. Feel the hamstrings stretch, then drive the hips forward.' },
  { id: 'calf_raise', name: 'Calf Raise', muscle: 'Legs', activity: 'Gym', equipment: 'Bodyweight', icon: 'arrow-up-outline', instructions: 'Rise onto the balls of the feet, pause at the top, lower slowly for a full stretch.' },

  // Shoulders
  { id: 'ohp', name: 'Overhead Press', muscle: 'Shoulders', activity: 'Gym', equipment: 'Barbell', icon: 'barbell-outline', instructions: 'Press the bar from the shoulders overhead, brace the core, finish with the bar over the mid-foot.' },
  { id: 'lateral_raise', name: 'Lateral Raise', muscle: 'Shoulders', activity: 'Gym', equipment: 'Dumbbell', icon: 'swap-horizontal-outline', instructions: 'Raise the dumbbells out to the sides to shoulder height with a slight elbow bend. Lower slowly.' },
  { id: 'face_pull', name: 'Face Pull', muscle: 'Shoulders', activity: 'Gym', equipment: 'Cable', icon: 'git-merge-outline', instructions: 'Pull the rope toward the face, elbows high, squeezing the rear delts and upper back.' },

  // Arms
  { id: 'biceps_curl', name: 'Biceps Curl', muscle: 'Arms', activity: 'Gym', equipment: 'Dumbbell', icon: 'barbell-outline', instructions: 'Elbows at the sides, curl the weight up, squeeze, lower fully. Avoid swinging.' },
  { id: 'triceps_dip', name: 'Triceps Dip', muscle: 'Arms', activity: 'Gym', equipment: 'Bodyweight', icon: 'body-outline', instructions: 'On a bench or bars, lower by bending the elbows, then press back up. Keep the elbows tracking back.' },
  { id: 'triceps_pushdown', name: 'Triceps Pushdown', muscle: 'Arms', activity: 'Gym', equipment: 'Cable', icon: 'git-merge-outline', instructions: 'Elbows pinned at the sides, extend the arms fully, control the return.' },

  // Core
  { id: 'plank', name: 'Plank', muscle: 'Core', activity: 'Gym', equipment: 'Bodyweight', icon: 'remove-outline', instructions: 'Forearms and toes down, body in a straight line, brace the core and glutes. Hold without sagging.' },
  { id: 'deadbug', name: 'Dead Bug', muscle: 'Core', activity: 'Pilates', equipment: 'Bodyweight', icon: 'body-outline', instructions: 'On your back, opposite arm and leg extend while the low back stays pressed to the floor. Alternate slowly.' },
  { id: 'bird_dog', name: 'Bird Dog', muscle: 'Core', activity: 'Pilates', equipment: 'Bodyweight', icon: 'paw-outline', instructions: 'On all fours, extend the opposite arm and leg, keep the hips level, pause, then switch.' },
  { id: 'hanging_leg_raise', name: 'Hanging Leg Raise', muscle: 'Core', activity: 'Gym', equipment: 'Bodyweight', icon: 'body-outline', instructions: 'Hang from a bar, raise the legs with control, avoid swinging, lower slowly.' },

  // Cardio
  { id: 'run_easy', name: 'Easy Run', muscle: 'Cardio', activity: 'Running', equipment: 'None', icon: 'walk-outline', instructions: 'Conversational pace. Keep the effort easy (RPE 3-4) to build aerobic base and aid recovery.' },
  { id: 'intervals', name: 'Interval Run', muscle: 'Cardio', activity: 'Interval Run', equipment: 'None', icon: 'timer-outline', instructions: 'Alternate hard efforts with easy recoveries (e.g. 4 x 3 min hard / 2 min easy). Warm up and cool down.' },
  { id: 'row_erg', name: 'Rowing (Erg)', muscle: 'Cardio', activity: 'Rowing', equipment: 'Machine', icon: 'boat-outline', instructions: 'Drive with the legs, then lean back and pull. Return in reverse. Keep a smooth, strong rhythm.' },
  { id: 'cycling', name: 'Cycling', muscle: 'Cardio', activity: 'Cycling', equipment: 'Bike', icon: 'bicycle-outline', instructions: 'Maintain a steady cadence (~85-95 rpm). Adjust resistance to hold your target effort.' },

  // Mobility
  { id: 'hip_flexor_stretch', name: 'Hip-Flexor Stretch', muscle: 'Mobility', activity: 'Yoga', equipment: 'None', icon: 'accessibility-outline', instructions: 'Half-kneel, tuck the pelvis, gently push the hips forward. Hold 30s each side without arching the back.' },
  { id: 'thoracic_rotation', name: 'Thoracic Rotation', muscle: 'Mobility', activity: 'Yoga', equipment: 'None', icon: 'sync-outline', instructions: 'On all fours, hand behind the head, rotate the elbow up toward the ceiling and back down. Slow and controlled.' },
  { id: 'couch_stretch', name: 'Calf Stretch', muscle: 'Mobility', activity: 'Yoga', equipment: 'None', icon: 'accessibility-outline', instructions: 'Back leg straight, heel down, lean into a wall until you feel the calf stretch. Hold 30s each side.' },
];
