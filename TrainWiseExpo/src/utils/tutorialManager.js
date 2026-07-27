import AsyncStorage from '@react-native-async-storage/async-storage';

// One AsyncStorage key per screen. A screen's tutorial shows the first time
// its screen is visited; once dismissed the key is set to 'true' forever
// (there is intentionally no reset option — see the ScreenTutorial system).
const KEYS = {
  home:          '@tw_tutorial_home',
  addWorkout:    '@tw_tutorial_add_workout',
  injuryReport:  '@tw_tutorial_injury_report',
  warnings:      '@tw_tutorial_warnings',
 programBuilder: '@tw_tutorial_program_builder',
liveRun:        '@tw_tutorial_live_run',
 nutrition:      '@tw_tutorial_nutrition',
 challenges:     '@tw_tutorial_challenges',
 coachMarketplace: '@tw_tutorial_coach_marketplace',
 events:           '@tw_tutorial_events',
 eventChat:         '@tw_tutorial_event_chat',



};

export const isTutorialDone = async (screenKey) => {
  const val = await AsyncStorage.getItem(KEYS[screenKey]);
  return val === 'true';
};

export const markTutorialDone = async (screenKey) => {
  await AsyncStorage.setItem(KEYS[screenKey], 'true');
};

// TEMPORARY (testing only) — wipes every tutorial key so all screen
// tutorials replay on the next visit. Remove together with the
// "Reset Screen Tutorials" button in SettingsScreen before release.
export const resetAllTutorials = async () => {
  await Promise.all(Object.values(KEYS).map(k => AsyncStorage.removeItem(k)));
};
