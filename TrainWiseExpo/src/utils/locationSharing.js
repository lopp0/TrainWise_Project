import AsyncStorage from '@react-native-async-storage/async-storage';

// A-2 — local mirror of the "share my live location" opt-in (default OFF).
// SocialContext reads this to decide whether to push GPS in the heartbeat;
// SettingsScreen writes it (and the server flag) when the toggle changes.
const KEY = '@trainwise_share_location';

export const getShareLocation = async () => {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
};

export const setShareLocationLocal = async (on) => {
  try {
    await AsyncStorage.setItem(KEY, on ? '1' : '0');
  } catch {}
};
