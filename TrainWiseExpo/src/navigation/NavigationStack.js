import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../api/AuthContext';
import { HealthSyncProvider, useHealthSync } from '../api/HealthSyncContext';
import { MessagesProvider } from '../api/MessagesContext';
import { SocialProvider, useSocial } from '../api/SocialContext';
import EventNotifications from '../api/EventNotifications';
import { Colors } from '../theme/colors';

import GoogleFitScreen from '../api/GoogleFitScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import SignUpFinal from '../screens/SignUpFinal';
import HomeRouter from '../screens/HomeRouter';
import CoachTraineeDetailScreen from '../screens/CoachTraineeDetailScreen';
import CoachTraineeAnalyticsScreen from '../screens/CoachTraineeAnalyticsScreen';
import StatsScreen from '../screens/StatsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import WarningsDashboardScreen from '../screens/WarningsDashboardScreen';
import AddWorkoutScreen from '../screens/AddWorkoutScreen';
import InjuryReportScreen from '../screens/InjuryReportScreen';
import ActiveInjuriesScreen from '../screens/ActiveInjuriesScreen';
import WorkoutSummaryScreen from '../screens/WorkoutSummaryScreen';
import WorkoutRouteScreen from '../screens/WorkoutRouteScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ConnectQRScreen from '../screens/ConnectQRScreen';
import ShopScreen from '../screens/ShopScreen';
import AIChatScreen from '../screens/AIChatScreen';
import ChatScreen from '../screens/ChatScreen';
import MyCoachScreen from '../screens/MyCoachScreen';
import ConnectScreen from '../screens/ConnectScreen';
import RequestsScreen from '../screens/RequestsScreen';
import PersonalRecordsScreen from '../screens/PersonalRecordsScreen';
import WorkoutBoardScreen from '../screens/WorkoutBoardScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import TrainingCalendarScreen from '../screens/TrainingCalendarScreen';



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
      <Stack.Screen name="WorkoutRoute" component={WorkoutRouteScreen} />
    </Stack.Navigator>
  );
};

const HomeStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeRouter} />
      <Stack.Screen name="CoachTraineeDetail" component={CoachTraineeDetailScreen} />
      <Stack.Screen name="CoachTraineeAnalytics" component={CoachTraineeAnalyticsScreen} />
      <Stack.Screen name="Stats" component={StatsScreen} />
      <Stack.Screen name="Warnings" component={WarningsDashboardScreen} />
      <Stack.Screen name="AddWorkout" component={AddWorkoutScreen} />
      <Stack.Screen name="InjuryReport" component={InjuryReportScreen} />
      <Stack.Screen name="ActiveInjuries" component={ActiveInjuriesScreen} />
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} />
      <Stack.Screen name="WorkoutRoute" component={WorkoutRouteScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ConnectQR" component={ConnectQRScreen} />
      <Stack.Screen name="Shop" component={ShopScreen} />
      <Stack.Screen name="AIChat" component={AIChatScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="MyNetwork" component={MyCoachScreen} />
      {/* B-1: Profile tab was removed; Profile is now reached by tapping the
          avatar in HomeHeader, pushed onto the Home stack. */}
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="PersonalRecords" component={PersonalRecordsScreen} />
      <Stack.Screen name="TrainingCalendar" component={TrainingCalendarScreen} />
    </Stack.Navigator>
  );
};

// Connect tab — discovery map (gyms + nearby people) + the requests inbox +
// the network hub + per-friend/coach chat (chat is user↔user, shared screen).
const ConnectStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ConnectMain" component={ConnectScreen} />
      <Stack.Screen name="Requests" component={RequestsScreen} />
      <Stack.Screen name="MyNetwork" component={MyCoachScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="WorkoutBoard" component={WorkoutBoardScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
    </Stack.Navigator>
  );
};

const AppTabs = () => {
  const { unconfirmedCount } = useHealthSync();
  const { pendingTotal } = useSocial();
  // Bottom inset for the system navigation bar. In 3-button ("Touches") mode
  // the system bar is tall and would otherwise sit ON TOP of the tab buttons,
  // stealing taps; gesture mode reports a small inset. Either way we lift the
  // tab bar above it.
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  // Coach-only users (isCoach && !isTrainee) don't track their own
  // workouts — they observe trainees. Hide the Health tab so it can't
  // be reached from the tab bar; the screen is still registered under
  // HomeStack for deep-link safety only.
  const isCoachOnly = !!user?.isCoach && !user?.isTrainee;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'LoadTab') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'HealthTab') {
            iconName = focused ? 'fitness' : 'fitness-outline';
          } else if (route.name === 'ConnectTab') {
            iconName = focused ? 'people' : 'people-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.cardBackground,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          // Add the system nav-bar inset so the tabs clear the Android
          // back/home/recents buttons (3-button mode) and the gesture pill.
          paddingBottom: insets.bottom + 5,
          paddingTop: 5,
          height: 60 + insets.bottom,
        },
      })}>
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home' }} />
      {/* B-1: second tab is the training-load (Warnings) screen, labeled "Load".
          Hidden for coach-only users (they don't track their own load). */}
      {!isCoachOnly && (
        <Tab.Screen
          name="LoadTab"
          component={WarningsDashboardScreen}
          options={{ title: 'Load' }}
        />
      )}
      {!isCoachOnly && (
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
      )}
      <Tab.Screen
        name="ConnectTab"
        component={ConnectStack}
        options={{
          title: 'Connect',
          tabBarBadge: pendingTotal > 0 ? pendingTotal : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.danger,
            color: '#fff',
            fontSize: 11,
            fontWeight: '800',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
        }}
      />
    </Tab.Navigator>
  );
};

const AppStack = () => (
  <HealthSyncProvider>
    <MessagesProvider>
      <SocialProvider>
        <EventNotifications />
        <AppTabs />
      </SocialProvider>
    </MessagesProvider>
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