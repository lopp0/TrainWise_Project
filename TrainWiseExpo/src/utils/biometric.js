import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * #112 — Biometric (fingerprint / face) app unlock.
 *
 * Purely client-side: when the user opts in, AuthContext gates the restored
 * session on a successful `authenticateAsync()` at launch. The user blob still
 * lives in AsyncStorage (same as before) — biometrics only guard re-entry.
 * Falls back to password (log out → Login) when biometric fails or is canceled.
 */
const KEY = '@trainwise_biometric_enabled';

// Hardware present AND the user has at least one fingerprint/face enrolled.
export const isBiometricSupported = async () => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && enrolled;
  } catch {
    return false;
  }
};

export const isBiometricEnabled = async () => {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    return false;
  }
};

export const setBiometricEnabled = async (on) => {
  try {
    await AsyncStorage.setItem(KEY, on ? 'true' : 'false');
  } catch {
    // ignore write errors
  }
};

// Prompt for biometric auth. Returns true on success, false on fail/cancel.
export const authenticateBiometric = async (reason = 'Unlock TrainWise') => {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use password',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return !!res?.success;
  } catch {
    return false;
  }
};
