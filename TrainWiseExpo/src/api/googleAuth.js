// Google Sign-In wrapper around @react-native-google-signin/google-signin.
// Uses the NATIVE account picker (no WebView, no redirect_uri) — this is what
// fixes the old "redirect_uri=trainwiseexpo:// / invalid_request" policy error,
// which came from trying a Web-client browser-redirect flow.
//
// We pass the WEB client ID as `webClientId` so signIn() returns an `idToken`
// that the backend verifies (POST /api/users/google-login). The Android OAuth
// client (package + our release-keystore SHA-1) authorizes the native call.
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../constants/google';

// configure() is idempotent and runs once on first import. Guarded so that if
// the native module isn't in the build yet (e.g. JS reloaded before the native
// rebuild), importing this file doesn't crash the Login screen — signInWithGoogle
// will surface a clear error instead.
let _configured = false;
try {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false, // we only need the idToken, not a server auth code
  });
  _configured = true;
} catch (e) {
  console.warn('[googleAuth] GoogleSignin native module not available yet:', e?.message);
}

/**
 * Launches the native Google account picker and returns the verified-by-us
 * payload to send to the backend. Throws on failure; the caller maps
 * statusCodes (CANCELLED, IN_PROGRESS, PLAY_SERVICES_NOT_AVAILABLE, etc.).
 * @returns {Promise<{ idToken: string, email?: string, fullName?: string }>}
 */
export async function signInWithGoogle() {
  if (!_configured) {
    throw new Error('Google Sign-In is not available in this build. Rebuild the app to include it.');
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  // v16 returns { type: 'success'|'cancelled', data: { idToken, user } };
  // older versions returned the userInfo object directly. Handle both.
  if (response?.type === 'cancelled') {
    const err = new Error('cancelled');
    err.code = statusCodes.SIGN_IN_CANCELLED;
    throw err;
  }
  const data = response?.data ?? response;
  const idToken = data?.idToken;
  const gUser = data?.user ?? {};

  if (!idToken) throw new Error('Google did not return an ID token.');
  return { idToken, email: gUser.email, fullName: gUser.name };
}

/** Best-effort sign-out so a fresh account picker shows next time. */
export async function signOutGoogle() {
  try { await GoogleSignin.signOut(); } catch { /* ignore */ }
}

export { statusCodes };
