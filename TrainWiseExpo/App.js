import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/api/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/NavigationStack';
import { navigationRef } from './src/navigation/navigationRef';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AppAlertProvider } from './src/components/AppAlertProvider';
import { InAppBannerProvider } from './src/components/InAppBanner';
import WhatsNewModal from './src/components/WhatsNewModal';
import BiometricLockOverlay from './src/components/BiometricLockOverlay';
import { initWeekStart } from './src/constants/weekStart';
import { initLanguage } from './src/i18n/i18n';
import { loadHcTombstones } from './src/constants/hcTombstones';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
  markAppOpened,
} from './src/api/NotificationService';

const ThemedRoot = () => {
  const { theme } = useTheme();

  // #181 — handle incoming share deep links (trainwiseexpo://workout/{id}).
  // Robust to custom-scheme host/path differences: just pull the numeric id.
  useEffect(() => {
    const handleUrl = (url) => {
      if (!url) return;
      const m = /workout\/(\d+)/.exec(url);
      if (m) navigationRef.current?.navigate('SharedWorkout', { workoutId: Number(m[1]) });
    };
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppAlertProvider>
          <InAppBannerProvider>
            <NavigationContainer ref={navigationRef}>
              <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
              <AppNavigator />
              <WhatsNewModal />
              <BiometricLockOverlay />
            </NavigationContainer>
          </InAppBannerProvider>
        </AppAlertProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default function App() {
  useEffect(() => {
    initWeekStart();
    initLanguage(); // #156 — load the saved language before the UI reads t()
    loadHcTombstones();
    (async () => {
      await requestNotificationPermission();
      // Record this launch BEFORE scheduling so the next notification's
      // escalation tier reflects today's open (otherwise we'd schedule
      // using yesterday's "daysAway" and the user gets nagged after
      // already engaging).
      await markAppOpened();
      // Neutral load on cold start — HomeScreen re-schedules with the
      // real values once it finishes computing the weekly stats.
      await scheduleDailyReminder();
    })();
  }, []);

  return (
    // AuthProvider OUTSIDE ThemeProvider: ThemeProvider re-mounts its subtree via
    // a key on theme/accent change; keeping AuthProvider above that boundary means
    // a color change no longer re-runs the launch/biometric check (#112 re-lock bug).
    <AuthProvider>
      <ThemeProvider>
        <ThemedRoot />
      </ThemeProvider>
    </AuthProvider>
  );
}
