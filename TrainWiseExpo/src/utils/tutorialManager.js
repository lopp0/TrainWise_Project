import AsyncStorage from '@react-native-async-storage/async-storage';

// One AsyncStorage key per screen. A screen's tutorial shows the first time
// its screen is visited; once dismissed the key is set to 'true' forever
// (there is intentionally no reset option — see the ScreenTutorial system).
const KEYS = {
  home:          '@tw_tutorial_home',
  addWorkout:    '@tw_tutorial_add_workout',
  injuryReport:  '@tw_tutorial_injury_report',
  warnings:      '@tw_tutorial_warnings',
};

export const isTutorialDone = async (screenKey) => {
  const val = await AsyncStorage.getItem(KEYS[screenKey]);
  return val === 'true';
};

export const markTutorialDone = async (screenKey) => {
  await AsyncStorage.setItem(KEYS[screenKey], 'true');
};
