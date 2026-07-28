import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@trainwise_onboarding_done';

export const isOnboardingDone = async () => {
  const val = await AsyncStorage.getItem(KEY);
  return val === 'true';
};

export const markOnboardingDone = async () => {
  await AsyncStorage.setItem(KEY, 'true');
};

/** Re-triggers onboarding on the next HomeScreen focus. Wired from the
 *  Settings "Reset Tutorial" row so we can rehearse the flow without
 *  uninstalling. */
export const resetOnboarding = async () => {
  await AsyncStorage.removeItem(KEY);
};
