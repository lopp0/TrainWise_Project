// מסך לוח אזהרות — סטטוס עומס, גרף שבועי, ACWR, המלצות
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
// אייקוני עזרה וניווט
import { Ionicons } from '@expo/vector-icons';
// BarChart מספריית react-native-chart-kit
import {BarChart} from 'react-native-chart-kit';
// ייבוא צבעים, גופנים וריווחים מהתמה
import {Colors, Fonts, Spacing} from '../theme/colors';
// קומפוננטים משותפים
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
// שליפת לוגי פעילות מה-Backend
import { getActivityLogsByUser } from '../services/api';
// userId של המשתמש המחובר
import { useAuth } from '../api/AuthContext';
// פונקציות ניהול יום תחילת שבוע
import {
  getWeekStartDate,
  getWeekStartDay,
  getWeekDayLabels,
  subscribeWeekStart,     // האזנה לשינוי יום תחילת שבוע
} from '../constants/weekStart';


// רוחב המסך לגרף BarChart
const screenWidth = Dimensions.get('window').width;

// פורמט קצר של תאריך: "Jan 5"
const formatShortDate = (d) =>
  `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;

// בניית תווית טווח שבוע: "This week · Jan 5 – Jan 11"
const getWeekRangeLabel = (offset, weekStartDay) => {
  const ws = getWeekStartDate(offset, weekStartDay);
  const we = new Date(ws);
  we.setDate(ws.getDate() + 6);
  if (offset === 0) return `This week · ${formatShortDate(ws)} – ${formatShortDate(we)}`;
  if (offset === -1) return `Last week · ${formatShortDate(ws)} – ${formatShortDate(we)}`;
  return `${formatShortDate(ws)} – ${formatShortDate(we)}`;
};

// קביעת רמת עומס לפי יחס ACWR: >1.3=Red, 0.8-1.3=Yellow, <0.8=Green
const determineLoadLevel = (ratio) => {
  if (ratio == null || ratio <= 0) return 'Green';
  if (ratio > 1.3) return 'Red';
  if (ratio >= 0.8) return 'Yellow';
  return 'Green';
};

// סיכום עומס סשנים בטווח תאריכים — תומך בשני פורמטי שמות שדות
const sumSessionLoadsInRange = (logs, startDate, endDate) => {
  return logs.reduce((sum, log) => {
    const st = new Date(log.startTime || log.StartTime);
    if (st >= startDate && st <= endDate) {
      return sum + Number(
        log.calculatedLoadForSession ?? log.CalculatedLoadForSession ?? 0,
      );
    }
    return sum;
  }, 0);
};

// בניית טקסט המלצה דינמי לפי רמת עומס + יחס ACWR
const buildRecommendation = (level, ratio, stress) => {
  if (ratio <= 0) {
    return 'No recent training detected. Log a workout to start tracking your load.';
  }
  if (level === 'Red') {
    return ratio > 1.5
      ? `Your training load has spiked sharply (AC ratio ${ratio.toFixed(2)}). Take 1–2 full rest days, hydrate, and prioritize sleep before your next session.`
      : `Load is in the high-risk zone (AC ratio ${ratio.toFixed(2)}). Swap your next session for an easy recovery workout or a rest day.`;
  }
  if (level === 'Yellow') {
    return ratio >= 1.0
      ? `You're training above baseline (AC ratio ${ratio.toFixed(2)}). Keep intensity moderate and avoid back-to-back hard sessions this week.`
      : `Load is building nicely (AC ratio ${ratio.toFixed(2)}). Stay consistent — one more steady session should keep you in the sweet spot.`;
  }
  return `You're in the safe zone (AC ratio ${ratio.toFixed(2)}). Good time to add a challenging session if you feel fresh.`;
};

const WarningsDashboardScreen = ({navigation}) => {
  // userId לשאילתות API
  const { userId } = useAuth();
  // האם בטעינה
  const [loading, setLoading] = useState(true);
  // עומס יומי לגרף — 7 ערכים (אחד לכל יום בשבוע)
  const [weeklyLoad, setWeeklyLoad] = useState([0, 0, 0, 0, 0, 0, 0]);
  // תוויות ציר X לגרף — שמות ימים לפי יום תחילת השבוע
  const [weekLabels, setWeekLabels] = useState(['Sun','Mon','Tue','Wed','Thu','Fri','Sat']);
  // רמת עומס נוכחית: 'Green' / 'Yellow' / 'Red'
  const [currentLoadLevel, setCurrentLoadLevel] = useState('Green');
  // יחס ACWR — Acute-to-Chronic Workload Ratio
  const [acRatio, setAcRatio] = useState(0);
  // ציון לחץ 0-100
  const [stressScore, setStressScore] = useState(0);
  // טקסט המלצה דינמי
  const [recommendation, setRecommendation] = useState(
    'No recommendation available yet. Log some workouts to get started.',
  );
  // הנושא של Help Modal שפתוח כרגע (null = סגור)
  const [helpTopic, setHelpTopic] = useState(null);
  // offset שבוע: 0=שבוע נוכחי, -1=שבוע שעבר וכו'
  const [weekOffset, setWeekOffset] = useState(0);
  // כל הלוגים המאושרים — לחישובי ACWR
  const [allLogs, setAllLogs] = useState([]);
  // היסטוריית עומס (לא בשימוש פעיל — שמורה לתאימות אחורה)
  const [allLoadHistory, setAllLoadHistory] = useState([]);
  // יום תחילת שבוע מוקומי — מתעדכן בזמן אמת דרך subscribe
  const [weekStartDay, setWeekStartDayState] = useState(getWeekStartDay());

  // האזנה לשינויים ביום תחילת השבוע (SettingsScreen → AsyncStorage → כאן)
  useEffect(() => {
    const unsub = subscribeWeekStart((day) => setWeekStartDayState(day));
    return () => unsub && unsub();
  }, []);

  // תוכן Help Modal לכל נושא
  const HELP_TEXT = {
    status: {
      title: 'Current Status',
      body:
        'Green = safe training zone. Yellow = monitor fatigue, consider easing off. Red = high injury risk — rest or reduce intensity.',
    },
    acRatio: {
      title: 'AC Ratio',
      body:
        'Acute-to-Chronic workload ratio. Compares your last 7 days of training to your longer-term average. Around 0.8–1.3 is the "sweet spot"; above 1.5 is high risk.',
    },
    stress: {
      title: 'Stress Score',
      body:
        'A 0–100 reading of how hard your last 7 days have been compared to your personal baseline. Higher means more accumulated fatigue.',
    },
    weekly: {
      title: 'Weekly Training Load',
      body:
        'Each bar shows your 7-day rolling acute load at the end of that day. A plateau across days is normal; sharp jumps indicate heavy recent sessions.',
    },
  };

  // טעינה ראשונית של לוגים בעלייה למסך
  useEffect(() => {
    loadDashboardData();
  }, []);

  // חישוב מחדש של הגרף והמדדים בכל שינוי של offset, לוגים או יום תחילת שבוע
  useEffect(() => {
    renderWeek(allLogs, allLoadHistory, weekOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, allLogs, allLoadHistory, weekStartDay]);

  /**
   * renderWeek — מחשב את כל המדדים עבור שבוע נתון.
   * משתמש בנוסחת ACWR המצומדת (Gabbett 2016):
   *   acute  = סכום עומסי הסשנים בשבוע המוצג (7 ימים)
   *   chronic = ממוצע שבועי ב-28 ימים הכוללים את השבוע המוצג
   */
  const renderWeek = (logs, loadHistory, offset) => {
    // תחילת השבוע המוצג לפי הגדרת המשתמש
    const weekStart = getWeekStartDate(offset, weekStartDay);
    // תוויות ימים בסדר הנכון
    const labels = getWeekDayLabels(weekStartDay);
    const weekData = new Array(7).fill(0);

    // חישוב עומס כל יום בשבוע המוצג
    // שני סשנים באותו יום מסתכמים; ימים ריקים נשארים 0
    logs.forEach((log) => {
      const st = new Date(log.startTime || log.StartTime);
      const d = new Date(st);
      d.setHours(0, 0, 0, 0);
      // מרחק בימים מתחילת השבוע
      const diffDays = Math.round(
        (d - weekStart) / (1000 * 60 * 60 * 24),
      );
      if (diffDays >= 0 && diffDays < 7) {
        weekData[diffDays] += Number(
          log.calculatedLoadForSession ?? log.CalculatedLoadForSession ?? 0,
        );
      }
    });
    setWeeklyLoad(weekData.map((v) => Math.round(v)));
    setWeekLabels(labels);

    // ACWR (נוסחה מצומדת, Gabbett 2016):
    //   acute   = סכום עומסי הסשנים בשבוע המוצג (7 ימים)
    //   chronic = ממוצע שבועי ב-28 ימים שמסתיימים ביום האחרון של השבוע המוצג
    //           = sum(28 ימים) / 4
    // הנוסחה הקודמת (21 ימים ללא שבוע נוכחי) גרמה לתנודתיות גבוהה
    // בין שבועות סמוכים — הנוסחה הנוכחית יציבה יותר ותואמת את ה-Backend.
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // חלון 28 ימים: 21 ימים לפני תחילת השבוע + 7 ימי השבוע המוצג
    const chronic28Start = new Date(weekStart);
    chronic28Start.setDate(weekStart.getDate() - 21);
    chronic28Start.setHours(0, 0, 0, 0);

    const acute = sumSessionLoadsInRange(logs, weekStart, weekEnd);
    const chronic28Sum = sumSessionLoadsInRange(logs, chronic28Start, weekEnd);
    const chronic = chronic28Sum / 4; // ממוצע שבועי על פני 4 שבועות

    // חישוב יחס ורמה:
    //   chronic > 0 : ACWR רגיל
    //   chronic = 0, acute = 0 : אין אימונים — Green
    //   chronic = 0, acute > 0 : אחרי מנוחה ארוכה — סיכון התחלה לפי עוצמה מוחלטת
    let ratio = 0;
    let level = 'Green';
    if (chronic > 0) {
      ratio = acute / chronic;
      level = determineLoadLevel(ratio);
    } else if (acute > 0) {
      // אין baseline — הערכת סיכון לפי עוצמה מוחלטת
      ratio = acute >= 1000 ? 2.0 : acute >= 300 ? 1.1 : 0.9;
      level = determineLoadLevel(ratio);
    }

    // ציון לחץ 0-100:
    // עם baseline: (acute/chronic) × 50, מוגבל ל-0-100
    // ללא baseline: acute/20, מוגבל ל-0-100
    let stress = 0;
    if (chronic > 0) {
      stress = Math.max(0, Math.min(100, Math.round((acute / chronic) * 50)));
    } else if (acute > 0) {
      stress = Math.max(0, Math.min(100, Math.round(acute / 20)));
    }

    // עדכון State לתצוגה
    setCurrentLoadLevel(level);
    setAcRatio(ratio);
    setStressScore(stress);
    setRecommendation(buildRecommendation(level, ratio, stress));
  };

  // שליפת כל הלוגים המאושרים מה-Backend
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const logsResponse = await getActivityLogsByUser(userId);
      // סינון לוגים לא מאושרים — isConfirmed === false
      const logs = (logsResponse.data || []).filter(
        (l) => (l.isConfirmed ?? l.IsConfirmed) !== false,
      );
      setAllLogs(logs);
      setAllLoadHistory([]); // לא בשימוש — שמורה לתאימות
    } catch (error) {
      console.log('Dashboard load error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // רענון — שולף מחדש את הלוגים (ה-ACWR מחושב מהם ישירות)
  const handleRefresh = async () => {
    await loadDashboardData();
  };

  // צבע לפי רמת עומס
  const getLevelColor = (level) => {
    if (level === 'Red') return Colors.red;
    if (level === 'Yellow') return Colors.yellow;
    return Colors.green;
  };

  // הגדרות עיצוב ה-BarChart
  const chartConfig = {
    backgroundGradientFrom: Colors.cardBackground,
    backgroundGradientTo: Colors.cardBackground,
    decimalPlaces: 0,              // ללא ספרות עשרוניות בגרף
    color: (opacity = 1) => `rgba(255, 64, 129, ${opacity})`,   // ורוד
    labelColor: (opacity = 1) => `rgba(176, 190, 197, ${opacity})`,
    barPercentage: 0.7,
    fillShadowGradient: Colors.primaryLight,
    fillShadowGradientOpacity: 1,
    propsForBackgroundLines: {
      stroke: Colors.border,
      strokeDasharray: '4',        // קווים מקוטעים
    },
  };

  // ערך מקסימום לציר Y — מעוגל ל-500 הקרובה, לפחות 100
  const chartMax = Math.max(100, Math.ceil(Math.max(...weeklyLoad, 0) / 500) * 500);
  // נתוני הגרף עם dataset מוסתר לנעילת ציר Y
  const chartData = {
    labels: weekLabels,
    datasets: [
      {
        data: weeklyLoad.length > 0 ? weeklyLoad : [0],
      },
      // Dataset שקוף — מגדיר את ציר Y המקסימלי לערך עגול
      { data: [chartMax], withDots: false, color: () => 'transparent' },
    ],
  };

  return (
    <View style={styles.container}>
      {/* כותרת המסך — ללא כפתור חזרה (טאב) */}
      <ScreenHeader title="Warnings" subtitle="Training Load Overview" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          // ספינר עד שהנתונים נטענים
          <ActivityIndicator
            size="large"
            color={Colors.primary}
            style={{marginTop: 40}}
          />
        ) : (
          <>
            {/* כרטיסיית מצב נוכחי */}
            <Card>
              {/* שורת כותרת + כפתור עזרה */}
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>Current Status</Text>
                <TouchableOpacity onPress={() => setHelpTopic('status')} hitSlop={8}>
                  <Ionicons name="help-circle-outline" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {/* נקודת מצב + טקסט Green/Yellow/Red */}
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {backgroundColor: getLevelColor(currentLoadLevel)},
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {color: getLevelColor(currentLoadLevel)},
                  ]}>
                  {currentLoadLevel}
                </Text>
              </View>
              {/* מדדים: AC Ratio + Stress — כל אחד עם כפתור עזרה */}
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <View style={styles.metricLabelRow}>
                    <Text style={styles.metricLabel}>AC Ratio</Text>
                    <TouchableOpacity onPress={() => setHelpTopic('acRatio')} hitSlop={8}>
                      <Ionicons name="help-circle-outline" size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {/* 2 ספרות עשרוניות */}
                  <Text style={styles.metricValue}>{acRatio.toFixed(2)}</Text>
                </View>
                <View style={styles.metric}>
                  <View style={styles.metricLabelRow}>
                    <Text style={styles.metricLabel}>Stress</Text>
                    <TouchableOpacity onPress={() => setHelpTopic('stress')} hitSlop={8}>
                      <Ionicons name="help-circle-outline" size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.metricValue}>{stressScore}/100</Text>
                </View>
              </View>
            </Card>

            {/* כרטיסיית גרף עומס שבועי */}
            <Card>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>Weekly Training Load</Text>
                <TouchableOpacity onPress={() => setHelpTopic('weekly')} hitSlop={8}>
                  <Ionicons name="help-circle-outline" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {/* ניווט בין שבועות — חץ שמאל/ימין + תווית טווח */}
              <View style={styles.weekNavRow}>
                {/* חץ אחורה — שבוע קודם */}
                <TouchableOpacity
                  style={styles.weekNavBtn}
                  onPress={() => setWeekOffset((o) => o - 1)}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.weekNavLabel}>{getWeekRangeLabel(weekOffset, weekStartDay)}</Text>
                {/* חץ קדימה — מושבת בשבוע הנוכחי */}
                <TouchableOpacity
                  style={[styles.weekNavBtn, weekOffset >= 0 && styles.weekNavBtnDisabled]}
                  onPress={() => weekOffset < 0 && setWeekOffset((o) => o + 1)}
                  disabled={weekOffset >= 0}
                  hitSlop={8}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={weekOffset >= 0 ? Colors.textMuted : Colors.primary}
                  />
                </TouchableOpacity>
              </View>
              {/* הגרף עצמו */}
              <BarChart
                data={chartData}
                width={screenWidth - Spacing.lg * 4}
                height={220}
                chartConfig={chartConfig}
                fromZero              // ציר Y מתחיל מ-0
                showValuesOnTopOfBars // ערך מעל כל עמודה
                withInnerLines        // קווי עזר אופקיים
                segments={4}
                style={styles.chart}
              />
              <Text style={styles.chartCaption}>Daily session load (load units)</Text>
            </Card>

            {/* כרטיסיית המלצה חכמה */}
            <Card>
              <Text style={styles.cardTitle}>Smart Recommendation</Text>
              <Text style={styles.recommendationText}>{recommendation}</Text>
            </Card>
          </>
        )}
      </ScrollView>

      {/* Help Modal — מוצג בלחיצה על ? */}
      <Modal
        visible={!!helpTopic}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpTopic(null)}
      >
        {/* לחיצה על הרקע סוגרת */}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.helpBackdrop}
          onPress={() => setHelpTopic(null)}
        >
          <View style={styles.helpCard}>
            {/* כותרת נושא העזרה */}
            <Text style={styles.helpTitle}>
              {helpTopic ? HELP_TEXT[helpTopic].title : ''}
            </Text>
            {/* גוף ההסבר */}
            <Text style={styles.helpBody}>
              {helpTopic ? HELP_TEXT[helpTopic].body : ''}
            </Text>
            {/* כפתור סגירה */}
            <TouchableOpacity
              style={styles.helpClose}
              onPress={() => setHelpTopic(null)}
            >
              <Text style={styles.helpCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* פס תחתון קבוע — כפתורי ניווט */}
      <View style={styles.bottomActions}>
        {/* כפתור Refresh — טוען מחדש את הלוגים */}
        <PrimaryButton title="Refresh" onPress={handleRefresh} />
        {/* שורת כפתורים משניים */}
        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('AddWorkout')}>
            <Text style={styles.secondaryButtonText}>Add Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('InjuryReport')}>
            <Text style={styles.secondaryButtonText}>Report Injury</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.secondaryButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// סגנונות המסך
const styles = StyleSheet.create({
  // מיכל ראשי
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  // כותרת כרטיסייה
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  // שורת מצב (נקודה + טקסט)
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  // נקודת מצב עגולה
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: 20,
    fontWeight: Fonts.bold,
  },
  // שורת מדדים — AC Ratio + Stress
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.sm,
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginTop: 4,
  },
  // הגרף — הזזה שמאלה לפיצוי על padding
  chart: {
    borderRadius: 12,
    marginLeft: -Spacing.md,
  },
  // טקסט המלצה
  recommendationText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    lineHeight: 22,
  },
  // פס תחתון קבוע
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  // כפתור משני
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
  // שורת כפתורים משניים
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.md,
  },
  // שורת כותרת + כפתור עזרה
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  // שורת תווית + ? ליד מדד
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // כיתוב תחת הגרף
  chartCaption: {
    textAlign: 'center',
    marginTop: Spacing.xs,
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
  },
  // שורת ניווט שבועי
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  weekNavBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  // כפתור ניווט מושבת — שקוף למחצה
  weekNavBtnDisabled: {
    opacity: 0.4,
  },
  weekNavLabel: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
    flex: 1,
    textAlign: 'center',
  },
  // רקע Help Modal — כהה חצי-שקוף
  helpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  // כרטיסיית Help Modal
  helpCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  helpTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.sm,
  },
  helpBody: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  // כפתור סגירת Help
  helpClose: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  helpCloseText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
});



export default WarningsDashboardScreen;
