import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import { HealthSyncProvider, useHealthSync } from '../api/HealthSyncContext';
import { Colors } from '../theme/colors';

import GoogleFitScreen from '../api/GoogleFitScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import SignUpFinal from '../screens/SignUpFinal';
import HomeScreen from '../screens/HomeScreen';
import StatsScreen from '../screens/StatsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import WarningsDashboardScreen from '../screens/WarningsDashboardScreen';
import AddWorkoutScreen from '../screens/AddWorkoutScreen';
import InjuryReportScreen from '../screens/InjuryReportScreen';
import ActiveInjuriesScreen from '../screens/ActiveInjuriesScreen';
import WorkoutSummaryScreen from '../screens/WorkoutSummaryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ConnectQRScreen from '../screens/ConnectQRScreen';



const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignUpFinal" component={SignUpFinal} />
    </Stack.Navigator>
  );
};

const HealthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HealthConnectMain" component={GoogleFitScreen} />
    </Stack.Navigator>
  );
};

const HomeStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Stats" component={StatsScreen} />
      <Stack.Screen name="Warnings" component={WarningsDashboardScreen} />
      <Stack.Screen name="AddWorkout" component={AddWorkoutScreen} />
      <Stack.Screen name="InjuryReport" component={InjuryReportScreen} />
      <Stack.Screen name="ActiveInjuries" component={ActiveInjuriesScreen} />
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ConnectQR" component={ConnectQRScreen} />
    </Stack.Navigator>
  );
};

const ProfileStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    </Stack.Navigator>
  );
};

const AppTabs = () => {
  const { unconfirmedCount } = useHealthSync();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'HealthTab') {
            iconName = focused ? 'fitness' : 'fitness-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.cardBackground,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      })}>
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home' }} />
      <Tab.Screen
        name="HealthTab"
        component={HealthStack}
        options={{
          title: 'Health',
          tabBarBadge: unconfirmedCount > 0 ? unconfirmedCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.primary,
            color: Colors.textPrimary,
            fontSize: 11,
            fontWeight: '800',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

const AppStack = () => (
  <HealthSyncProvider>
    <AppTabs />
  </HealthSyncProvider>
);

const AppNavigator = () => {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return isLoggedIn ? <AppStack /> : <AuthStack />;
};

export default AppNavigator;