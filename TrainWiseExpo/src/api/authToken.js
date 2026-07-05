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
