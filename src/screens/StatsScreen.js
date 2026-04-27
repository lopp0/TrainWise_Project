// מסך סטטיסטיקות — תצוגת עמודות שבועית + עריכת נתוני יום נבחר
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
// SafeAreaView — מגן על notch
import { SafeAreaView } from 'react-native-safe-area-context';
// אייקוני ניווט
import { Ionicons } from '@expo/vector-icons';
// userId ו-user מה-AuthContext
import { useAuth } from '../api/AuthContext';
// לוגי פעילות מה-Backend + עדכון + יצירה
import { getActivityLogs, putActivityLog, postActivityLog } from '../api/api';
// חישוב עומס יומי לאחר עדכון
import { calculateDailyLoad } from '../services/api';
// שליפת אימונים מ-HC לתצוגה
import { getStructuredWorkouts } from '../api/HealthConnectService';
// buildWeeklyData ו-getBarColor משותפים עם HomeScreen
import { buildWeeklyData, getBarColor } from './HomeScreen';
import { Colors, Fonts } from '../theme/colors';

// רוחב המסך לחישוב גדלי תאים
const { width } = Dimensions.get('window');

// שמות ימי השבוע
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// מחשב את תחילת השבוע הנוכחי בחצות (ראשון)
const getWeekStart = () => {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() - today.getDay());  // ראשון = יום 0
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── גרף עמודות שבועי (תצוגה A) ──────────────────────────────────
// props: weeklyData, maxValue, onBarPress, selectedIndex
const WeeklyBarChart = ({ weeklyData, maxValue, onBarPress, selectedIndex }) => {
  // גובה מרבי של עמודה
  const CHART_H = 110;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', flex: 1 }}>
      {weeklyData.map((item, i) => {
        // גובה העמודה: יחסי לעומס, מינימום 6px
        const barH =
          item.load > 0 ? Math.max(6, (item.load / maxValue) * CHART_H) : 6;
        const isSelected = selectedIndex === i;
        return (
          <TouchableOpacity
            key={i}
            style={{ flex: 1, alignItems: 'center' }}
            onPress={() => onBarPress?.(i)}
            activeOpacity={0.75}
          >
            <View style={{ height: CHART_H, justifyContent: 'flex-end', alignItems: 'center' }}>
              <View
                style={{
                  width: 22,
                  height: barH,
                  backgroundColor: getBarColor(item.load),
                  borderRadius: 4,
                  // גבול לבן לעמודה הנבחרת
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: Colors.textPrimary,
                }}
              />
            </View>
            <Text style={styles.dayLabel}>{DAYS[item.dayIndex]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── גרף מוגדל — מציג יום נבחר ±1 (תצוגה B) ─────────────────────
// props: weeklyData, selectedIndex, onSelect
const ZoomedBarChart = ({ weeklyData, selectedIndex, onSelect }) => {
  const CHART_H = 140;
  // אינדקסים: יום לפני, יום נבחר, יום אחרי (מסוננים לגבולות 0-6)
  const indices = [selectedIndex - 1, selectedIndex, selectedIndex + 1].filter(
    (i) => i >= 0 && i < 7
  );
  const zoomedData = indices.map((i) => weeklyData[i]);
  // ציר Y: מקסימום מבין 3 הימים, לפחות 20
  const maxValue = Math.max(...zoomedData.map((d) => d.load), 20);

  return (
    <View style={styles.zoomedChartWrap}>
      {zoomedData.map((item, i) => {
        const idx = indices[i];
        const isSelected = idx === selectedIndex;
        const barH =
          item.load > 0 ? Math.max(8, (item.load / maxValue) * CHART_H) : 8;
        return (
          <TouchableOpacity
            key={i}
            style={{ flex: 1, alignItems: 'center' }}
            activeOpacity={0.7}
            onPress={() => onSelect?.(idx)}
          >
            <View style={{ height: CHART_H, justifyContent: 'flex-end', alignItems: 'center' }}>
              <View
                style={{
                  // עמודה נבחרת רחבה יותר
                  width: isSelected ? 60 : 36,
                  height: barH,
                  backgroundColor: getBarColor(item.load),
                  borderRadius: 6,
                  // עמודות לא נבחרות — חצי-שקופות
                  opacity: isSelected ? 1 : 0.45,
                }}
              />
            </View>
            {/* תווית יום — מודגשת ביום הנבחר */}
            <Text
              style={[
                styles.dayLabel,
                isSelected && { color: Colors.textPrimary, fontWeight: Fonts.bold },
              ]}
            >
              {DAYS[item.dayIndex]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── מסך סטטיסטיקות ────────────────────────────────────────────────
const StatsScreen = ({ navigation, route }) => {
  // user ו-userId מה-AuthContext
  const { user, userId } = useAuth();

  // נתונים
  const [backendLogs, setBackendLogs] = useState([]);
  const [hcWorkouts, setHcWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  // מצב תצוגה: 'overview' = גרף שבועי; 'detail' = יום נבחר + עריכה
  const [viewMode, setViewMode] = useState('overview');
  // אינדקס היום הנבחר בתצוגה B
  const [selectedDayIdx, setSelectedDayIdx] = useState(null);

  // שדות טופס העריכה
  const [editDuration, setEditDuration] = useState('');
  const [editExertion, setEditExertion] = useState('');
  const [editDistance, setEditDistance] = useState('');
  const [editPulse, setEditPulse] = useState('');
  const [saving, setSaving] = useState(false);

  // פרמטר ניווט ממתין — אינדקס יום שנשלח מ-HomeScreen
  // נשמר בנפרד כדי לפתוח detail רק אחרי שהנתונים נטענו
  const [pendingDayIdx, setPendingDayIdx] = useState(null);

  // טעינת לוגים מ-Backend ומ-HC
  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const logs = await getActivityLogs(userId);
      setBackendLogs(logs || []);
    } catch (e) {
      console.warn('[StatsScreen] Backend load failed:', e.message);
    }
    try {
      const weekStart = getWeekStart();
      const hcData = await getStructuredWorkouts(weekStart, new Date());
      setHcWorkouts(hcData || []);
    } catch (e) {
      console.warn('[StatsScreen] Health Connect unavailable:', e.message);
    }
    setLoading(false);
  }, [userId]);

  // טעינה ראשונית
  useEffect(() => {
    loadData();
  }, [loadData]);

  // שמירת פרמטר ניווט לשימוש לאחר טעינה
  useEffect(() => {
    if (route?.params?.selectedDayIndex !== undefined) {
      setPendingDayIdx(route.params.selectedDayIndex);
    }
  }, [route?.params]);

  // בניית נתוני הגרף מהלוגים
  const weeklyData = buildWeeklyData(backendLogs, hcWorkouts);
  // ציר Y: מקסימום עומס בין כל הימים, לפחות 20
  const maxLoad = Math.max(...weeklyData.map((d) => d.load), 20);

  // פתיחת תצוגה B אחרי שהנתונים נטענו והיה pending day
  useEffect(() => {
    if (!loading && pendingDayIdx !== null) {
      openDetail(pendingDayIdx, weeklyData);
      setPendingDayIdx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingDayIdx]);

  // פתיחת תצוגת פרטי יום — מאכלסת את שדות הטופס מהנתונים הקיימים
  const openDetail = (dayIdx, data) => {
    const dayData = (data || weeklyData)[dayIdx];
    if (!dayData) return;

    setSelectedDayIdx(dayIdx);

    if (dayData.source === 'backend' && dayData.log) {
      // נתונים קיימים מה-Backend — מאכלסים את הטופס
      const log = dayData.log;
      setEditDuration(String(log.duration ?? 0));
      setEditExertion(String(log.exertionLevel ?? 0));
      setEditDistance(String(log.distanceKM ?? 0));
      setEditPulse(String(log.avgHeartRate ?? 0));
    } else {
      // יום ריק או HC — אפסים עד שהמשתמש מזין נתונים
      setEditDuration('0');
      setEditExertion('0');
      setEditDistance('0');
      setEditPulse('0');
    }
    setViewMode('detail');
  };

  // שמירת שינויים — עדכון או יצירת לוג + חישוב מחדש של עומס
  const handleApplyChanges = async () => {
    if (selectedDayIdx === null) return;
    const dayData = weeklyData[selectedDayIdx];

    setSaving(true);
    try {
      // בסיס הלוג — מה-Backend, מ-HC, או ריק
      const baseLog = dayData.log || dayData.hcWorkout || {};
      const durationMin = parseInt(editDuration) || 0;

      // אימות: לא מרשים לוג לתאריך עתידי
      const now = new Date();
      const isFuture = dayData.date > now;
      if (isFuture) {
        Alert.alert('Invalid Date', 'Cannot log a workout for a future day.');
        setSaving(false);
        return;
      }
      // אימות: משך חיובי
      if (durationMin <= 0) {
        Alert.alert('Missing Info', 'Please enter a valid duration.');
        setSaving(false);
        return;
      }

      // זמני התחלה/סיום: מה-Backend אם קיימים, אחרת מחישוב
      const endTime = baseLog.endTime
        ? new Date(baseLog.endTime)
        : new Date(dayData.date.getTime() + 12 * 60 * 60 * 1000);  // חצות יום
      const startTime = baseLog.startTime
        ? new Date(baseLog.startTime)
        : new Date(endTime.getTime() - durationMin * 60000);

      const exertion = parseInt(editExertion) || 5;
      const payload = {
        userID: userId,
        activityTypeID: baseLog.activityTypeID || 5,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: durationMin,
        exertionLevel: exertion,
        distanceKM: parseFloat(editDistance) || 0,
        avgHeartRate: parseInt(editPulse) || 0,
        maxHeartRate: baseLog.maxHeartRate || 0,
        caloriesBurned: baseLog.caloriesBurned || 0,
        sourceDevice: 'Health Connect',
        // חישוב עומס: דקות × רמת מאמץ
        calculatedLoadForSession: Math.round(durationMin * exertion),
        isConfirmed: true,
      };

      if (dayData.source === 'backend' && dayData.log) {
        // לוג קיים — עדכון
        await putActivityLog({
          ...payload,
          activityID: dayData.log.activityID,
        });
      } else {
        // לוג חדש — יצירה מ-HC data
        await postActivityLog(payload);
      }

      try {
        // חישוב מחדש של היום הנערך + היום הנוכחי
        // (כדי שחלונות ACWR ישקפו את השינוי)
        await calculateDailyLoad(userId, dayData.date);
        const today = new Date();
        if (dayData.date.toDateString() !== today.toDateString()) {
          await calculateDailyLoad(userId, today);
        }
      } catch (recalcErr) {
        console.warn('[StatsScreen] Recalc failed:', recalcErr.message);
      }

      Alert.alert('Saved', 'Changes applied successfully!');
      // טעינה מחדש וחזרה לתצוגה A
      await loadData();
      setViewMode('overview');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // נתונים נגזרים לתצוגה A
  const sessionCount = weeklyData.filter((d) => d.load > 0).length;
  const totalLoad = weeklyData.reduce((sum, d) => sum + d.load, 0);

  // הודעת מצב עומס שבועי
  const getLoadStatus = () => {
    if (totalLoad === 0) return 'No training data this week.';
    if (totalLoad <= 30) return 'Your current stats are balanced!';
    if (totalLoad <= 60) return 'Your weekly load is moderate – stay consistent!';
    return 'Your weekly load is high – consider resting.';
  };

  // ── רנדר ─────────────────────────────────────────────────────────

  // ספינר טעינה ראשונית
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator
          color={Colors.primary}
          size="large"
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  // ── תצוגה B: פרטי יום + עריכה ─────────────────────────────────
  if (viewMode === 'detail' && selectedDayIdx !== null) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* כפתור חזרה לתצוגה A */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setViewMode('overview')}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          {/* גרף מוגדל עם ניווט ימים */}
          <View style={styles.chartCard}>
            {/* שורת ניווט: חץ שמאל, שם יום, חץ ימין */}
            <View style={styles.dayNavRow}>
              {/* חץ שמאל — יום קודם (מושבת ביום הראשון) */}
              <TouchableOpacity
                style={[styles.dayNavBtn, selectedDayIdx <= 0 && styles.dayNavBtnDisabled]}
                onPress={() => selectedDayIdx > 0 && openDetail(selectedDayIdx - 1, weeklyData)}
                disabled={selectedDayIdx <= 0}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={20} color={selectedDayIdx <= 0 ? Colors.textMuted : Colors.primary} />
              </TouchableOpacity>
              {/* שם היום הנבחר */}
              <Text style={styles.dayNavLabel}>{DAYS[weeklyData[selectedDayIdx].dayIndex]}</Text>
              {/* חץ ימין — יום הבא (מושבת ביום האחרון) */}
              <TouchableOpacity
                style={[styles.dayNavBtn, selectedDayIdx >= 6 && styles.dayNavBtnDisabled]}
                onPress={() => selectedDayIdx < 6 && openDetail(selectedDayIdx + 1, weeklyData)}
                disabled={selectedDayIdx >= 6}
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={20} color={selectedDayIdx >= 6 ? Colors.textMuted : Colors.primary} />
              </TouchableOpacity>
            </View>
            {/* גרף מוגדל + ציר Y */}
            <View style={styles.chartRow}>
              <View style={styles.yAxis}>
                <Text style={styles.yLabel}>{maxLoad}</Text>
                <Text style={styles.yLabel}>0</Text>
              </View>
              <ZoomedBarChart
                weeklyData={weeklyData}
                selectedIndex={selectedDayIdx}
                onSelect={(i) => openDetail(i, weeklyData)}
              />
            </View>
          </View>

          {/* כותרת קטע עריכה */}
          <Text style={styles.editSectionTitle}>CHANGE DATE STATS:</Text>

          {/* גריד שדות עריכה — 2×2 */}
          <View style={styles.fieldsGrid}>
            {/* משך */}
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>SESSION DURATION</Text>
              <TextInput
                style={styles.fieldInput}
                value={editDuration}
                onChangeText={setEditDuration}
                keyboardType="numeric"
                placeholder="min"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* רמת מאמץ */}
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>EXERTION LEVEL</Text>
              <TextInput
                style={styles.fieldInput}
                value={editExertion}
                onChangeText={setEditExertion}
                keyboardType="numeric"
                placeholder="1–10"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* מרחק */}
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>DISTANCE</Text>
              <TextInput
                style={styles.fieldInput}
                value={editDistance}
                onChangeText={setEditDistance}
                keyboardType="numeric"
                placeholder="km"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* דופק */}
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>PULSE</Text>
              <TextInput
                style={styles.fieldInput}
                value={editPulse}
                onChangeText={setEditPulse}
                keyboardType="numeric"
                placeholder="bpm"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          {/* כפתור שמירת שינויים */}
          <TouchableOpacity
            style={[styles.applyBtn, saving && styles.applyBtnDisabled]}
            onPress={handleApplyChanges}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textPrimary} />
            ) : (
              <Text style={styles.applyBtnText}>Apply changes!</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── תצוגה A: סקירה שבועית ─────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* כותרת עם אייקון fitness + קיצור להגדרות */}
        <View style={styles.overviewHeader}>
          <Ionicons name="fitness-outline" size={26} color={Colors.primary} />
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="settings-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.statsTitle}>Your stats</Text>

        {/* כרטיסיית הגרף השבועי */}
        <View style={styles.chartCard}>
          {weeklyData.every((d) => d.load === 0) ? (
            // הודעה כשאין נתונים
            <Text style={styles.noDataText}>No workouts this week</Text>
          ) : (
            <View style={styles.chartRow}>
              {/* ציר Y */}
              <View style={styles.yAxis}>
                <Text style={styles.yLabel}>{maxLoad}</Text>
                <Text style={styles.yLabel}>0</Text>
              </View>
              {/* גרף שבועי — לחיצה על עמודה פותחת תצוגה B */}
              <WeeklyBarChart
                weeklyData={weeklyData}
                maxValue={maxLoad}
                onBarPress={(i) => openDetail(i, weeklyData)}
                selectedIndex={selectedDayIdx}
              />
            </View>
          )}
        </View>

        {/* רמז לחיצה */}
        <Text style={styles.chartHint}>Click on a column to inspect or change your stats!</Text>

        {/* קופסת סיכום שבועי */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>
            You have had{' '}
            <Text style={styles.summaryHighlight}>{sessionCount} training sessions</Text>
            {' '}this week!
          </Text>
          <Text style={styles.summaryStatus}>{getLoadStatus()}</Text>
          <Text style={styles.summaryDetail}>Detailed explanation here...</Text>
        </View>

        {/* כפתור חזרה לדף הבית */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.navigate('HomeMain')}
        >
          <Text style={styles.homeBtnText}>Home page</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// סגנונות המסך
const styles = StyleSheet.create({
  // רקע תמה
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },

  // ── תצוגה A
  // כותרת עליונה: fitness icon + settings
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.primary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
  },
  // כרטיסיית גרף
  chartCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 12,
    paddingBottom: 8,
    minHeight: 150,
    justifyContent: 'center',
    marginBottom: 8,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // ציר Y
  yAxis: {
    width: 30,
    justifyContent: 'space-between',
    paddingBottom: 22,
    paddingTop: 4,
  },
  yLabel: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  // תווית יום
  dayLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 5,
  },
  // רמז לחיצה
  chartHint: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  noDataText: {
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 30,
  },
  // קופסת סיכום
  summaryBox: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 28,
    gap: 8,
  },
  summaryText: {
    color: Colors.textPrimary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  // מספר הסשנים — מודגש בצבע מותג
  summaryHighlight: {
    fontWeight: '800',
    color: Colors.primary,
  },
  summaryStatus: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  summaryDetail: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // כפתור Home page
  homeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  homeBtnText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── תצוגה B
  // כפתור חזרה
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  // מיכל גרף מוגדל
  zoomedChartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
    paddingHorizontal: 8,
  },
  // שורת ניווט ימים
  dayNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  dayNavBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dayNavBtnDisabled: {
    opacity: 0.4,
  },
  dayNavLabel: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  // כותרת קטע עריכה
  editSectionTitle: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  // גריד 2×2 של שדות
  fieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  // תא שדה יחיד
  fieldCell: {
    width: (width - 44) / 2,       // שני תאים ברוחב מחושב
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // תווית שדה
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  // שדה קלט בסיסי — ללא רקע (שקוף לתוך ה-fieldCell)
  fieldInput: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inputBorder,
  },
  // כפתור "Apply changes"
  applyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  // מושבת בזמן שמירה
  applyBtnDisabled: {
    opacity: 0.6,
  },
  applyBtnText: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    fontStyle: 'italic',
  },
});

export default StatsScreen;
