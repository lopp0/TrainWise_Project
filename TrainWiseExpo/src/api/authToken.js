import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Holds the signed JWT issued by the backend on login/signup/google-login and
 * attaches it to every API request (via the axios interceptors in api/api.js and
 * services/api.js). Kept in a module-level variable so interceptors can read it
 * synchronously, and mirrored to AsyncStorage so it survives app restarts.
 *
 * NOTE: AsyncStorage is app-sandboxed but not encrypted. For production, move the
 * token to expo-secure-store (Keychain / Keystore). Left as AsyncStorage here to
 * keep this a JS-only change (no native rebuild) during the auth rollout.
 */
const TOKEN_KEY = '@trainwise_token';

let _token = null;

export const setAuthToken = async (token) => {
  _token = token || null;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    /* non-fatal: token still held in memory for this session */
  }
};

export const clearAuthToken = () => setAuthToken(null);

/** Restore the token into memory on app startup (call from AuthContext bootstrap). */
export const loadAuthToken = async () => {
  try {
    _token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    _token = null;
  }
  return _token;
};

export const getAuthToken = () => _token;

/**
 * Global "the token is no longer valid" hook.
 *
 * A stored token can stop being accepted without the app knowing: switching
 * BACKEND_MODE local↔azure (each backend signs with a different JWT_KEY), the
 * token expiring, or an Azure App Service restart when JWT_KEY is unset (the
 * key is then random per process). Before this hook, every request just 401'd
 * and the UI sat on "Loading…" forever with no way out.
 *
 * AuthContext registers a handler that clears the session and sends the user
 * back to Login; the axios interceptors call it on any 401.
 */
let _onUnauthorized = null;

export const setUnauthorizedHandler = (fn) => { _onUnauthorized = fn; };

export const handleUnauthorized = () => {
  clearAuthToken();
  try { _onUnauthorized?.(); } catch { /* never let logout throw into a response handler */ }
};
