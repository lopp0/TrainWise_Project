import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/api/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/NavigationStack';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { initWeekStart } from './src/constants/weekStart';
import { loadHcTombstones } from './src/constants/hcTombstones';

const ThemedRoot = () => {
  const { theme } = useTheme();
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default function App() {
  useEffect(() => {
    initWeekStart();
    loadHcTombstones();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedRoot />
      </AuthProvider>
    </ThemeProvider>
  );
}
