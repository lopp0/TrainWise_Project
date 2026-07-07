// In-app "What's New" changelog (feature #178).
//
// Bump APP_VERSION and add a new entry at the TOP whenever you ship a build.
// `WhatsNewModal` shows the newest entry once per version (tracked in
// AsyncStorage under @trainwise_seen_version), so returning users see what
// changed exactly once after an update.
export const APP_VERSION = '1.0.0';

export const CHANGELOG = [
  {
    version: '1.0.0',
    title: "What's new",
    items: [
      'Sign in with Google — now verified securely on the server.',
      'Notification settings: choose exactly what you get pinged about, plus quiet hours.',
      'Weekly recap: a short summary of your training every week.',
      'Lighter background updates that save battery and mobile data.',
      'Polish and fixes across the app.',
    ],
  },
];
