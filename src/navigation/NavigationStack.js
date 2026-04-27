// ניהול מבנה הניווט — Stack, Tabs וניהול מצב אימות
import React from 'react';
// ActivityIndicator לטעינה ראשונית
import { View, ActivityIndicator } from 'react-native';
// Stack Navigator — ניווט בין מסכים עם אנימציית כניסה/יציאה
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// Tab Navigator — שורת טאבים תחתית
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// אייקוני Ionicons לטאבים
import { Ionicons } from '@expo/vector-icons';
// קבלת מצב ההתחברות
import { useAuth } from '../api/AuthContext';
// Context הסנכרון — ספירת badge לטאב Health
import { HealthSyncProvider, useHealthSync } from '../api/HealthSyncContext';
// ייבוא צבעים מהתמה
import { Colors } from '../theme/colors';

// ייבוא כל המסכים
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



// יצירת Stack Navigator ו-Tab Navigator
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// AuthStack — מסכי ברירת מחדל למשתמש לא מחובר
const AuthStack = () => {
  return (
    // headerShown: false — ללא header ברירת מחדל
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignUpFinal" component={SignUpFinal} />
    </Stack.Navigator>
  );
};

// HealthStack — מסך Health Connect בתוך Stack
const HealthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HealthConnectMain" component={GoogleFitScreen} />
    </Stack.Navigator>
  );
};

// HomeStack — מסך הבית ועוד מסכים שמתחתיו
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

// ProfileStack — מסך הפרופיל בתוך Stack
const ProfileStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    </Stack.Navigator>
  );
};

// AppTabs — שורת הטאבים הראשית של האפליקציה
const AppTabs = () => {
  // קבלת ספירת אימונים לא מאושרים להצגת badge
  const { unconfirmedCount } = useHealthSync();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // פונקציה שמחזירה את האייקון המתאים לכל טאב
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          // בחירת אייקון לפי שם הטאב ומצב focus
          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'HealthTab') {
            iconName = focused ? 'fitness' : 'fitness-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        // צבע אייקון פעיל — צבע מותג
        tabBarActiveTintColor: Colors.primary,
        // צבע אייקון לא פעיל — אפור
        tabBarInactiveTintColor: Colors.textMuted,
        // סגנון שורת הטאבים
        tabBarStyle: {
          backgroundColor: Colors.cardBackground,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      })}>
      {/* טאב בית */}
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home' }} />
      {/* טאב Health — עם badge לאימונים לא מאושרים */}
      <Tab.Screen
        name="HealthTab"
        component={HealthStack}
        options={{
          title: 'Health',
          // badge מוצג רק אם יש אימונים לא מאושרים
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
      {/* טאב פרופיל */}
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

// AppStack — עוטף את AppTabs ב-HealthSyncProvider
const AppStack = () => (
  // HealthSyncProvider מאפשר ל-AppTabs לגשת לסנכרון HC
  <HealthSyncProvider>
    <AppTabs />
  </HealthSyncProvider>
);

// AppNavigator — מחליט מה להציג: Auth flow או App flow
const AppNavigator = () => {
  // isLoggedIn: האם מחובר; isLoading: טוען מ-AsyncStorage
  const { isLoggedIn, isLoading } = useAuth();

  // בזמן בדיקת מצב האימות — מציג spinner
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // מחובר → AppStack (טאבים); לא מחובר → AuthStack (Login/SignUp)
  return isLoggedIn ? <AppStack /> : <AuthStack />;
};

export default AppNavigator;
