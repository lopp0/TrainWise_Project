// Dynamic Expo config — keeps the Google Maps API key OUT of version control.
//
// The static base config still lives in app.json (with an EMPTY apiKey
// placeholder). This file overrides android.config.googleMaps.apiKey with the
// value from the environment at build time. The real key belongs in
// TrainWiseExpo/.env (gitignored) as:
//
//   GOOGLE_MAPS_API_KEY=your-restricted-android-maps-key
//
// Expo loads .env into process.env when it evaluates this file, so the key is
// injected into the native build without ever being committed. The key still
// ends up inside the built APK (unavoidable for the Maps SDK) — protect it with
// Google Cloud API key RESTRICTIONS (Android package + SHA-1, restricted APIs),
// not by secrecy.
module.exports = ({ config }) => {
  const key =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    '';

  config.android = config.android || {};
  config.android.config = config.android.config || {};
  config.android.config.googleMaps = {
    ...(config.android.config.googleMaps || {}),
    apiKey: key,
  };

  return config;
};
