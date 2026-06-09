import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/api/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/NavigationStack';
import { navigationRef } from './src/navigation/navigationRef';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AppAlertProvider } from './src/components/AppAlertProvider';
import { InAppBannerProvider } from './src/components/InAppBanner';
import { initWeekStart } from './src/constants/weekStart';
import { loadHcTombstones } from './src/constants/hcTombstones';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
  markAppOpened,
} from './src/api/NotificationService';

const ThemedRoot = () => {
  const { theme } = useTheme();
  return (
    <SafeAreaProvider>
      <AppAlertProvider>
        <InAppBannerProvider>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
            <AppNavigator />
          </NavigationContainer>
        </InAppBannerProvider>
      </AppAlertProvider>
    </SafeAreaProvider>
  );
};

export default function App() {
  useEffect(() => {
    initWeekStart();
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
    <ThemeProvider>
      <AuthProvider>
        <ThemedRoot />
      </AuthProvider>
    </ThemeProvider>
  );
}
