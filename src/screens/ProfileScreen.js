// מסך פרופיל — הצגת פרטי המשתמש וכפתור התנתקות
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
// SafeAreaView מבטיח שהתוכן לא מכוסה על ידי notch/status bar
import { SafeAreaView } from 'react-native-safe-area-context';
// Ionicons לאייקון האדם
import { Ionicons } from '@expo/vector-icons';
// קבלת נתוני המשתמש ופונקציית logout
import { useAuth } from '../api/AuthContext';
// ייבוא צבעים, גופנים וריווחים מהתמה
import { Colors, Fonts, Spacing } from '../theme/colors';

const ProfileScreen = () => {
  // שליפת אובייקט המשתמש ופונקציית logout מה-AuthContext
  const { user, logout } = useAuth();

  // מערך השורות להצגה בכרטיס המידע — label + value מהאובייקט user
  const rows = [
    { label: 'Full Name', value: user?.fullName },
    { label: 'Email', value: user?.email },
    { label: 'Username', value: user?.userName },
    { label: 'Activity Level', value: user?.activityLevel },
    { label: 'Experience Level', value: user?.experienceLevel },
    // הצגת גובה עם יחידה אם קיים
    { label: 'Height', value: user?.height ? `${user.height} cm` : undefined },
    // הצגת משקל עם יחידה אם קיים
    { label: 'Weight', value: user?.weight ? `${user.weight} kg` : undefined },
    // הצגת תפקיד לפי isCoach
    { label: 'Role', value: user?.isCoach ? 'Coach' : 'Trainee' },
  ];

  return (
    // SafeAreaView מגן מפני חפיפה עם ה-notch
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* עיגול אווטאר עם אייקון אדם */}
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={54} color={Colors.textMuted} />
        </View>

        {/* שם המשתמש — ברירת מחדל 'Athlete' */}
        <Text style={styles.name}>{user?.fullName || 'Athlete'}</Text>
        {/* כתובת אימייל */}
        <Text style={styles.email}>{user?.email || ''}</Text>

        {/* כרטיס מידע — מיפוי שורות */}
        <View style={styles.card}>
          {rows.map((row, i) => (
            <View
              key={i}
              // הוספת גבול תחתון לכל שורה חוץ מהאחרונה
              style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
            >
              {/* תווית השדה משמאל */}
              <Text style={styles.label}>{row.label}</Text>
              {/* ערך השדה מימין — '—' אם חסר */}
              <Text style={styles.value}>
                {row.value !== undefined && row.value !== null ? String(row.value) : '—'}
              </Text>
            </View>
          ))}
        </View>

        {/* כפתור התנתקות */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// סגנונות מסך הפרופיל
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    alignItems: 'center',     // מרכז הכל אופקית
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,          // עיגול מלא
    backgroundColor: Colors.cardBackground,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  name: {
    fontSize: 22,
    fontWeight: Fonts.bold,
    color: Colors.primary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',        // גבולות עיגול חלים על התוכן הפנימי
    marginBottom: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,                   // תופס מקום שווה עם ה-value
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: Fonts.semiBold,
    textAlign: 'right',
    flex: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,  // מסגרת בצבע מותג
  },
  logoutText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: Fonts.bold,
  },
});

export default ProfileScreen;
