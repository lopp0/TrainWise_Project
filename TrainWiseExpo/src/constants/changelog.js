// In-app "What's New" changelog (feature #178).
//
// Bump APP_VERSION and add a new entry at the TOP whenever you ship a build.
// `WhatsNewModal` shows the newest entry once per version (tracked in
// AsyncStorage under @trainwise_seen_version), so returning users see what
// changed exactly once after an update.
export const APP_VERSION = '1.2.0';

export const CHANGELOG = [
  {
    version: '1.2.0',
    title: "What's new",
    items: [
      'Injury-risk gauge on the Load tab: one score from your load spikes and monotony.',
      'Weekly goals with a progress ring, plus quests with coin rewards on Home.',
      'Exercise library with how-to instructions, tagged by activity.',
      'Tap-the-body-map injury picker and recovery tips per injury.',
      'Per-activity personal bests, heart-rate zones, and month/year load history.',
    ],
  },
  {
    version: '1.1.0',
    title: "What's new",
    items: [
      'Calorie balance ring on Home: log food, see your daily budget vs workouts burned.',
      'Customize your Home dashboard: reorder or hide widgets from the Customize button.',
      'Accent colors, auto dark mode, and a best-time-to-train tip on the smart card.',
      'Re-injury risk alert when your load spikes while an injury is still active.',
      'Notification settings with quiet hours, plus a weekly training recap.',
    ],
  },
  {
    version: '1.0.0',
    title: "What's new",
    items: [
      'Sign in with Google, now verified securely on the server.',
      'Notification settings: choose exactly what you get pinged about, plus quiet hours.',
      'Weekly recap: a short summary of your training every week.',
      'Lighter background updates that save battery and mobile data.',
      'Polish and fixes across the app.',
    ],
  },
];
