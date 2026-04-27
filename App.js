// דרוש לתמיכה בתנועות מגע (swipe, drag) בכל האפליקציה — חייב להיות ייבוא ראשון
import 'react-native-gesture-handler';
// ייבוא React ו-useEffect לניהול תופעות לוואי
import React, { useEffect } from 'react';
// SafeAreaProvider מבטיח שהתוכן לא יחפוף את ה-notch / status bar במכשירים שונים
import { SafeAreaProvider } from 'react-native-safe-area-context';
// StatusBar שולטת בצבע שורת הסטטוס העליונה (שעון, סוללה וכו')
import { StatusBar } from 'expo-status-bar';
// AuthProvider עוטף את האפליקציה ומספק מצב התחברות לכל המסכים
import { AuthProvider } from './src/api/AuthContext';
// NavigationContainer הוא העטיפה החיצונית של מערכת הניווט
import { NavigationContainer } from '@react-navigation/native';
// AppNavigator מגדיר את כל הניווט בין המסכים
import AppNavigator from './src/navigation/NavigationStack';
// ThemeProvider ו-useTheme מנהלים את עיצוב הצבעים (כהה/בהיר)
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
// initWeekStart טוען את הגדרת יום תחילת השבוע שנשמרה
import { initWeekStart } from './src/constants/weekStart';
// loadHcTombstones טוען רשימת אימונים שנמחקו ע"י המשתמש (כדי לא לייבאם שוב)
import { loadHcTombstones } from './src/constants/hcTombstones';

// ThemedRoot — קומפוננט שמרנדר את עץ הניווט ומגיב לשינוי תמה
const ThemedRoot = () => {
  // קבלת ערך התמה הנוכחית ('dark' / 'light')
  const { theme } = useTheme();
  return (
    // SafeAreaProvider מגדיר את גבולות ה-safe area לכל צאצאיו
    <SafeAreaProvider>
      {/* NavigationContainer עוטף את כל מסכי הניווט */}
      <NavigationContainer>
        {/* StatusBar משתנה בין light/dark לפי התמה — dark theme דורש אייקונים בהירים */}
        <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
        {/* AppNavigator מחליט מה להציג: מסכי Auth או מסכי האפליקציה */}
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

// קומפוננט הבסיס של האפליקציה — הכל מתחיל כאן
export default function App() {
  // useEffect רץ פעם אחת עם עליית האפליקציה ([] = אין תלויות)
  useEffect(() => {
    // טוען את הגדרת יום תחילת השבוע מ-AsyncStorage
    initWeekStart();
    // טוען את רשימת האימונים שנמחקו (tombstones) כדי למנוע ייבוא כפול
    loadHcTombstones();
  }, []);

  return (
    // ThemeProvider מספק את מצב הצבעים (כהה/בהיר) לכל הצאצאים
    <ThemeProvider>
      {/* AuthProvider מספק מצב התחברות ופונקציות login/logout */}
      <AuthProvider>
        {/* ThemedRoot מרנדר את NavigationContainer בתוך ThemeProvider */}
        <ThemedRoot />
      </AuthProvider>
    </ThemeProvider>
  );
}
