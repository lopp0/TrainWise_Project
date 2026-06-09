import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
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
  const { pendingTotal } = useSocial();
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
          } else if (route.name === 'HealthTab') {
            iconName = focused ? 'fitness' : 'fitness-outline';
          } else if (route.name === 'ConnectTab') {
            iconName = focused ? 'people' : 'people-outline';
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
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ title: 'Profile' }} />
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