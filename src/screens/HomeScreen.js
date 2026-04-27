// מסך הבית — ברכה, כפתורי פעולה מהירה, גרף עומס שבועי
import React, { useState, useEffect, useCallback } from 'react';
// useFocusEffect — רענון נתונים בכל פעם שהמסך מקבל focus
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
// SafeAreaView — מגן על notch
import { SafeAreaView } from 'react-native-safe-area-context';
// אייקוני הגדרות ואווטר
import { Ionicons } from '@expo/vector-icons';
// user ו-userId של המשתמש המחובר
import { useAuth } from '../api/AuthContext';
// שליפת לוגי פעילות מה-Backend
import { getActivityLogs } from '../api/api';
// axios instance ישיר לשאילתות נוספות (warnings count)
import apiClient from '../api/api';
// שליפת אימונים מ-Health Connect לתצוגה
import { getStructuredWorkouts } from '../api/HealthConnectService';
// חישוב תאריך תחילת שבוע לפי הגדרת המשתמש
import { getWeekStartDate, getWeekDayLabels } from '../constants/weekStart';
// צבעי ערכת הנושא
import { Colors } from '../theme/colors';

// רוחב המסך לחישוב גדלי כפתורים
const { width } = Dimensions.get('window');

// שמות ימי השבוע באנגלית קצרה — מיושרים לפי dayIndex (0=ראשון)
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * getBarColor — מחזיר צבע עמוד הגרף לפי ערך העומס.
 * עמודות ריקות מקבלות צבע רקע כדי "להיעלם" בכרטיסייה.
 * צבעי עומס קבועים (אדום/צהוב/ירוק) — לא משתנים עם הערכה.
 */
export const getBarColor = (load) => {
  if (load <= 0) return Colors.cardBackgroundLight; // עמודה ריקה
  if (load < 150) return '#00e676';   // עומס קל — ירוק
  if (load < 300) return '#ffee58';   // עומס בינוני — צהוב
  if (load < 500) return '#ff9800';   // עומס גבוה — כתום
  return '#f44336';                   // עומס גבוה מאוד — אדום
};

// מחזיר את תחילת השבוע הנוכחי בחצות לפי הגדרת המשתמש
const getWeekStart = () => getWeekStartDate(0);

/**
 * buildWeeklyData — בונה מערך של 7 אלמנטים (יום אחד לכל עמודה).
 * מעדיף לוגים מאושרים מה-Backend; Health Connect משמש רק כ-fallback.
 *
 * @param {Array} backendLogs - לוגי פעילות מה-Backend
 * @param {Array} hcWorkouts - אימונים מ-Health Connect
 * @returns {Array} מערך {date, dayIndex, load, source, log, hcWorkout}
 */
export const buildWeeklyData = (backendLogs, hcWorkouts) => {
  const weekStart = getWeekStart();

  // בניית 7 אלמנטים — יום אחד לכל רשומה
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return {
      date: d,
      // dayIndex = JS day-of-week (0=ראשון) — שומר על תוויות נכונות
      // ללא קשר ליום תחילת השבוע שהוגדר
      dayIndex: d.getDay(),
      load: 0,
      source: 'none',
      log: null,
      hcWorkout: null,
    };
  });

  // מיפוי מחרוזת תאריך → אינדקס ב-weekDays לחיפוש מהיר
  const dateToIndex = {};
  weekDays.forEach((wd, i) => {
    dateToIndex[wd.date.toDateString()] = i;
  });

  // מקור 1: לוגים מאושרים מה-Backend — מסכמים כל הסשנים ביום
  (backendLogs || []).forEach((log) => {
    const key = new Date(log.startTime || log.StartTime).toDateString();
    const idx = dateToIndex[key];
    if (idx === undefined) return; // לוג מחוץ לטווח השבוע
    // תמיכה בשני פורמטי שמות שדות (camelCase ו-PascalCase)
    const sessionLoad = Number(
      log.calculatedLoadForSession ??
        log.CalculatedLoadForSession ??
        Math.round(((log.duration || 0) * (log.exertionLevel || 5)) / 10)
    );
    weekDays[idx].load += sessionLoad;
    weekDays[idx].source = 'backend';
    weekDays[idx].log = log;
  });

  // רק לוגים מאושרים נחשבים לדשבורד העומס.
  // Health Connect לא מוצג אוטומטית — לוג שנמחק נשאר ריק.

  // עיגול כל עמודה למספר שלם
  weekDays.forEach((d) => {
    d.load = Math.round(d.load);
  });

  return weekDays;
};

// ─── קומפוננט WeeklyBarChart — גרף עמודות שבועי ────────────────
// props: weeklyData, maxValue, onBarPress, selectedIndex
const WeeklyBarChart = ({ weeklyData, maxValue, onBarPress, selectedIndex }) => {
  // גובה מרבי של עמודה בפיקסלים
  const CHART_H = 110;
  return (
    <View style={chartStyles.root}>
      {weeklyData.map((item, i) => {
        // גובה עמודה: יחסי לעומס; מינימום 6px כדי להראות עמודה ריקה
        const barH =
          item.load > 0
            ? Math.max(6, (item.load / maxValue) * CHART_H)
            : 6;
        // האם זו העמודה הנבחרת (גבול לבן)
        const isSelected = selectedIndex === i;
        return (
          <TouchableOpacity
            key={i}
            style={chartStyles.col}
            onPress={() => onBarPress?.(i)}
            activeOpacity={0.75}
          >
            {/* עמודה — גדלה מלמטה */}
            <View style={[chartStyles.barWrapper, { height: CHART_H }]}>
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: barH,
                    backgroundColor: getBarColor(item.load),
                    // גבול לבן לעמודה שנבחרה
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: Colors.textPrimary,
                  },
                ]}
              />
            </View>
            {/* תווית היום תחת העמודה */}
            <Text style={chartStyles.dayLabel}>{DAYS[item.dayIndex]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// סגנונות הגרף
const chartStyles = StyleSheet.create({
  // שורת כל העמודות — מיושרות לתחתית
  root: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
  },
  // עמודה יחידה
  col: {
    flex: 1,
    alignItems: 'center',
  },
  // מיכל הגובה המקסימלי — מיישר את העמודה לתחתית
  barWrapper: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // צורת העמודה עצמה
  bar: {
    width: 30,
    borderRadius: 5,
  },
  // תווית יום
  dayLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 5,
  },
});

// ─── מסך הבית ────────────────────────────────────────────────────
const HomeScreen = ({ navigation }) => {
  // user — אובייקט המשתמש (לברכה); userId — לשאילתות API
  const { user, userId } = useAuth();
  // לוגים מה-Backend לבניית הגרף
  const [backendLogs, setBackendLogs] = useState([]);
  // אימונים מ-HC (לא בשימוש פעיל כרגע — שמורים לעתיד)
  const [hcWorkouts, setHcWorkouts] = useState([]);
  // האם בטעינה (ספינר בגרף)
  const [loading, setLoading] = useState(true);
  // מספר אזהרות שלא נקראו — badge על כפתור "See warnings"
  const [unreadWarnings, setUnreadWarnings] = useState(0);

  // loadData — טוען לוגים, HC ו-warnings count
  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // 1. לוגים מה-Backend
    try {
      const logs = await getActivityLogs(userId);
      setBackendLogs(logs || []);
    } catch (e) {
      console.warn('[HomeScreen] Backend load failed:', e.message);
    }

    // 2. אימונים מ-Health Connect (לתצוגה עתידית)
    try {
      const weekStart = getWeekStart();
      const hcData = await getStructuredWorkouts(weekStart, new Date());
      setHcWorkouts(hcData || []);
    } catch (e) {
      console.warn('[HomeScreen] Health Connect unavailable:', e.message);
    }

    // 3. ספירת אזהרות שלא נקראו — נסיון endpoint מהיר, fallback לספירה ידנית
    try {
      const res = await apiClient.get(`/api/CoachRecommendations/user/${userId}/unread-count`);
      setUnreadWarnings(res.data ?? 0);
    } catch {
      try {
        // fallback: שליפת כל האזהרות וספירת isRead === false
        const res = await apiClient.get(`/api/CoachRecommendations/user/${userId}`);
        const count = (res.data || []).filter((w) => w.isRead === false).length;
        setUnreadWarnings(count);
      } catch {
        // endpoint לא מוכן — מתעלמים בשקט
      }
    }

    setLoading(false);
  }, [userId]);

  // רענון בכל פעם שהמסך מקבל focus (לדוגמה: חזרה מ-AddWorkout)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // בניית נתוני הגרף מהלוגים
  const weeklyData = buildWeeklyData(backendLogs, hcWorkouts);
  // ציר Y: מקסימום מבין כל הימים, לפחות 100
  const maxLoad = Math.max(...weeklyData.map((d) => d.load), 100);

  // לחיצה על עמודה בגרף — מעבר למסך Stats עם היום הנבחר
  const handleBarPress = (dayIndex) => {
    navigation.navigate('Stats', { selectedDayIndex: dayIndex });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* באנר אזהרות — מוצג רק אם יש אזהרות שלא נקראו */}
        {unreadWarnings > 0 && (
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={() => navigation.navigate('Warnings')}
          >
            <Text style={styles.warningBannerTitle}>
              You have {unreadWarnings} unread warnings
            </Text>
            <Text style={styles.warningBannerSubtitle}>
              Click here to view
            </Text>
          </TouchableOpacity>
        )}

        {/* שורת אייקון הגדרות — מיושר לימין */}
        <View style={styles.gearRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="settings-outline" size={26} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* שורה עליונה: ברכה + אווטר */}
        <View style={styles.topRow}>
          {/* "Hello\n{שם}!" — שתי שורות, גופן גדול */}
          <Text style={styles.helloText}>
            {'Hello\n'}
            <Text style={styles.helloName}>{user?.fullName || 'Athlete'}!</Text>
          </Text>
          {/* עיגול אווטר עם אייקון person */}
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={48} color={Colors.textMuted} />
          </View>
        </View>

        {/* כותרת "מה תרצה לעשות היום" */}
        <Text style={styles.subtitle}>WHAT WOULD YOU LIKE TO DO TODAY?</Text>

        {/* כפתורי פעולה מהירה — שתי שורות */}
        <View style={styles.buttonsWrap}>
          {/* שורה ראשונה: Add Workout + See Warnings */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('AddWorkout')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{'Add a\nworkout'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('Warnings')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{'See\nwarnings'}</Text>
            </TouchableOpacity>
          </View>

          {/* שורה שנייה: Report Injury — מרוכז (כפתור ציאן) */}
          <View style={styles.btnRowCenter}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cyanBtn]}
              onPress={() => navigation.navigate('InjuryReport')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{'Report\ninjury'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* כרטיסיית הגרף השבועי */}
        <View style={styles.chartCard}>
          {loading ? (
            // ספינר בזמן טעינה
            <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 40 }} />
          ) : weeklyData.every((d) => d.load === 0) ? (
            // הודעה כשאין אימונים השבוע
            <Text style={styles.noDataText}>No workouts this week</Text>
          ) : (
            <View style={styles.chartRow}>
              {/* ציר Y — מקסימום ו-0 */}
              <View style={styles.yAxis}>
                <Text style={styles.yLabel}>{maxLoad}</Text>
                <Text style={styles.yLabel}>0</Text>
              </View>
              {/* הגרף — לחיצה על עמודה מעבירה ל-StatsScreen */}
              <WeeklyBarChart
                weeklyData={weeklyData}
                maxValue={maxLoad}
                onBarPress={handleBarPress}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// רוחב כפתור: שני כפתורים זה לצד זה עם padding + gap
const BTN_W = (width - 52) / 2;

// סגנונות המסך
const styles = StyleSheet.create({
  // רקע כהה מאוד
  safe: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  scroll: {
    padding: 16,
    paddingBottom: 36,
  },

  // שורת ההגדרות — מיושרת לימין
  gearRow: {
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
  },

  // שורה עליונה: ברכה + אווטר
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  helloText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ff2d6f',
    fontStyle: 'italic',
    lineHeight: 40,
    flex: 1,
  },
  // שם המשתמש — גדול יותר מ-"Hello"
  helloName: {
    fontSize: 36,
  },
  // עיגול אווטר — גבול עדין
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#0d1117',
    borderWidth: 2,
    borderColor: '#2d333b',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  // כותרת "WHAT WOULD YOU LIKE TO DO TODAY?"
  subtitle: {
    color: '#00e5cc',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginBottom: 22,
    letterSpacing: 0.4,
  },

  // עטיפת כפתורי הפעולה
  buttonsWrap: {
    marginBottom: 24,
    gap: 14,
  },
  // שורה של שני כפתורים
  btnRow: {
    flexDirection: 'row',
    gap: 14,
  },
  // שורה עם כפתור אחד מרוכז
  btnRowCenter: {
    alignItems: 'center',
  },
  // כפתור פעולה בסיסי — לבן
  actionBtn: {
    width: BTN_W,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  // כפתור ציאן (Report Injury)
  cyanBtn: {
    backgroundColor: '#00e5cc',
  },
  // טקסט כפתור — ורוד ומודגש
  actionBtnText: {
    color: '#ff2d6f',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 21,
  },

  // כרטיסיית הגרף
  chartCard: {
    backgroundColor: '#161b22',
    borderRadius: 14,
    padding: 16,
    paddingBottom: 12,
    minHeight: 160,
    justifyContent: 'center',
  },
  // שורת הגרף + ציר Y
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // ציר Y — תוויות מקסימום ו-0
  yAxis: {
    width: 30,
    justifyContent: 'space-between',
    paddingBottom: 22,
    paddingTop: 4,
  },
  yLabel: {
    color: '#666',
    fontSize: 11,
  },
  // הודעת "אין נתונים"
  noDataText: {
    color: '#555',
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 30,
  },

  // באנר אזהרות — ורוד כהה
  warningBanner: {
    backgroundColor: '#c2185b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  warningBannerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  warningBannerSubtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default HomeScreen;
