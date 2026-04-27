// מסך סיכום אימון — מציג את תוצאות האימון שנרשם זה עתה
import React from 'react';
// רכיבי UI בסיסיים
import {View, Text, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
// ייבוא צבעים, גופנים וריווחים מהתמה
import {Colors, Fonts, Spacing} from '../theme/colors';
// קומפוננטים משותפים
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';

const WorkoutSummaryScreen = ({navigation, route}) => {
  // שליפת נתוני הסיכום מהפרמטרים שהועברו מ-AddWorkoutScreen
  // אם אין פרמטרים — ערכי ברירת מחדל לדמו
  const summary = route?.params?.summary || {
    activityName: 'Running',
    duration: 45,
    exertion: 7,
    sessionLoad: 315,
    loadLevel: 'Green',
    acuteLoad: 1200,
    chronicLoad: 1100,
    acRatio: 1.09,
    stressScore: 55,
    recommendation: 'Good balanced session. Keep your current rhythm.',
  };

  // מחזיר צבע לפי רמת העומס: Red/Yellow/Green
  const getLevelColor = (level) => {
    if (level === 'Red') return Colors.red;
    if (level === 'Yellow') return Colors.yellow;
    return Colors.green;
  };

  return (
    <View style={styles.container}>
      {/* כותרת המסך עם כפתור חזרה */}
      <ScreenHeader
        title="Workout Summary"
        subtitle="Your session results"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* כרטיס פרטי האימון */}
        <Card>
          <Text style={styles.cardTitle}>Session Details</Text>
          {/* שורת סוג הפעילות */}
          <View style={styles.row}>
            <Text style={styles.label}>Activity</Text>
            <Text style={styles.value}>{summary.activityName}</Text>
          </View>
          {/* שורת משך האימון */}
          <View style={styles.row}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.value}>{summary.duration} min</Text>
          </View>
          {/* שורת רמת המאמץ */}
          <View style={styles.row}>
            <Text style={styles.label}>Exertion</Text>
            <Text style={styles.value}>{summary.exertion}/10</Text>
          </View>
          {/* שורת עומס הסשן — מודגשת בצבע מותג */}
          <View style={styles.row}>
            <Text style={styles.label}>Session Load</Text>
            <Text style={styles.valuePrimary}>{summary.sessionLoad}</Text>
          </View>
        </Card>

        {/* כרטיס הערכת עומס */}
        <Card>
          <Text style={styles.cardTitle}>Load Assessment</Text>
          {/* badge צבעוני של רמת העומס */}
          <View style={styles.levelContainer}>
            <View
              style={[
                styles.levelBadge,
                {backgroundColor: getLevelColor(summary.loadLevel)},
              ]}>
              <Text style={styles.levelText}>{summary.loadLevel}</Text>
            </View>
          </View>
          {/* רשת מדדים: Acute/Chronic/AC Ratio/Stress */}
          <View style={styles.metricsGrid}>
            {/* עומס חריף (7 ימים) */}
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Acute Load</Text>
              <Text style={styles.metricValue}>
                {Math.round(summary.acuteLoad)}
              </Text>
              <Text style={styles.metricSub}>7-day</Text>
            </View>
            {/* עומס כרוני (28 ימים) */}
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Chronic Load</Text>
              <Text style={styles.metricValue}>
                {Math.round(summary.chronicLoad)}
              </Text>
              <Text style={styles.metricSub}>28-day</Text>
            </View>
            {/* יחס AC — acute/chronic */}
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>AC Ratio</Text>
              <Text style={styles.metricValue}>
                {summary.acRatio.toFixed(2)}
              </Text>
              <Text style={styles.metricSub}>acute/chronic</Text>
            </View>
            {/* ציון סטרס 0-100 */}
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Stress</Text>
              <Text style={styles.metricValue}>{summary.stressScore}</Text>
              <Text style={styles.metricSub}>0-100</Text>
            </View>
          </View>
        </Card>

        {/* כרטיס המלצה לאימון הבא */}
        <Card>
          <Text style={styles.cardTitle}>Recommendation</Text>
          <Text style={styles.recommendationText}>{summary.recommendation}</Text>
        </Card>
      </ScrollView>

      {/* כפתורי פעולה תחתיים */}
      <View style={styles.bottomActions}>
        {/* חזרה לדשבורד */}
        <PrimaryButton
          title="Back to Dashboard"
          onPress={() => navigation.navigate('Warnings')}
        />
        {/* הוספת אימון נוסף */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('AddWorkout')}>
          <Text style={styles.secondaryButtonText}>Log Another Workout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// סגנונות המסך
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  // שורת label + value
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  // ערך מודגש בצבע מותג
  valuePrimary: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
  },
  // מיכל ה-badge של רמת העומס — ממורכז
  levelContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  levelBadge: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 30,
  },
  levelText: {
    color: '#000',              // שחור על רקע צבעוני — קריא
    fontSize: 22,
    fontWeight: Fonts.bold,
    letterSpacing: 2,
  },
  // רשת 2x2 של מדדים
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  metric: {
    width: '48%',               // שני עמודות
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: Fonts.bold,
    marginTop: Spacing.xs,
  },
  metricSub: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  recommendationText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    lineHeight: 22,
  },
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
});

export default WorkoutSummaryScreen;
