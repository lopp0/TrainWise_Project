// מסך הוספת אימון ידני — טופס לרישום סשן אימון
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
// ייבוא צבעים, גופנים וריווחים מהתמה
import {Colors, Fonts, Spacing} from '../theme/colors';
// קומפוננטים משותפים
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import ComboBox from '../components/ComboBox';
// פונקציות API: שליפת סוגי פעילות, יצירת לוג, וחישוב עומס יומי
import {
  getAllActivityTypes,
  createActivityLog,
  calculateDailyLoad,
} from '../services/api';
// userId של המשתמש המחובר מה-AuthContext
import { useAuth } from '../api/AuthContext';


const AddWorkoutScreen = ({navigation}) => {
  // userId — מזהה המשתמש לשמירת הלוג תחת החשבון הנכון
  const { userId } = useAuth();
  // רשימת סוגי הפעילות הנטענת מה-Backend
  const [activityTypes, setActivityTypes] = useState([]);
  // הפעילות שנבחרה מה-ComboBox
  const [selectedActivity, setSelectedActivity] = useState(null);
  // משך האימון בדקות (מחרוזת לאימות קל)
  const [duration, setDuration] = useState('');
  // רמת המאמץ: 1–10 (ברירת מחדל 5)
  const [exertion, setExertion] = useState(5);
  // מרחק בק"מ — אופציונלי
  const [distance, setDistance] = useState('');
  // דופק ממוצע — אופציונלי
  const [avgHeartRate, setAvgHeartRate] = useState('');
  // דופק מקסימלי — אופציונלי
  const [maxHeartRate, setMaxHeartRate] = useState('');
  // האם בטעינת סוגי הפעילות (ספינר)
  const [loading, setLoading] = useState(true);
  // האם שליחת הטופס בתהליך (ספינר בכפתור)
  const [submitting, setSubmitting] = useState(false);

  // טעינת סוגי הפעילות בעלייה למסך
  useEffect(() => {
    loadActivityTypes();
  }, []);

  // שולף סוגי פעילות מה-Backend; אם נכשל — מחזיר רשימת ברירת מחדל
  const loadActivityTypes = async () => {
    try {
      const response = await getAllActivityTypes();
      setActivityTypes(response.data || []);
    } catch (error) {
      console.log('Failed to load activity types:', error.message);
      // רשימת fallback כדי שהמסך יפעל גם ללא Backend
      setActivityTypes([
        {activityTypeID: 1, typeName: 'Running'},
        {activityTypeID: 2, typeName: 'Walking'},
        {activityTypeID: 3, typeName: 'Cycling'},
        {activityTypeID: 4, typeName: 'CrossFit'},
        {activityTypeID: 5, typeName: 'Swimming'},
      ]);
    } finally {
      // סיום טעינה בכל מקרה
      setLoading(false);
    }
  };

  // שליחת האימון — אימות, חישוב עומס, שמירה ב-Backend, ניווט לסיכום
  const handleApply = async () => {
    // אימות שדה חובה: סוג פעילות
    if (!selectedActivity) {
      Alert.alert('Missing Info', 'Please select an activity type');
      return;
    }
    // אימות שדה חובה: משך בדקות (מספר שלם תקין)
    if (!duration || isNaN(parseInt(duration, 10))) {
      Alert.alert('Missing Info', 'Please enter a valid duration in minutes');
      return;
    }

    setSubmitting(true);
    try {
      // זמן הסיום = עכשיו; זמן התחלה = עכשיו פחות הדקות שהוזנו
      const now = new Date();
      const start = new Date(now.getTime() - parseInt(duration, 10) * 60000);

      // חישוב עומס הסשן: דקות × רמת מאמץ (RPE × duration = session load)
      const sessionLoad = parseInt(duration, 10) * exertion;

      // שליחת הלוג ל-Backend עם כל שדות הסכמה
      await createActivityLog({
        userID: userId,
        activityTypeID: selectedActivity.activityTypeID,
        startTime: start.toISOString(),
        endTime: now.toISOString(),
        distanceKM: parseFloat(distance) || 0,
        avgHeartRate: parseInt(avgHeartRate, 10) || 0,
        maxHeartRate: parseInt(maxHeartRate, 10) || 0,
        caloriesBurned: 0,
        sourceDevice: 'Manual',          // מקור ידני (לא Health Connect)
        exertionLevel: exertion,
        duration: parseInt(duration, 10),
        calculatedLoadForSession: Math.round(sessionLoad),
        isConfirmed: true,                // אימון ידני — מאושר מיד
      });

      // חישוב מחדש של העומס היומי + ACWR אחרי שמירת הלוג
      const calcResponse = await calculateDailyLoad(userId);
      const result = calcResponse.data || {};

      // ניווט למסך סיכום עם נתוני העומס
      navigation.navigate('WorkoutSummary', {
        summary: {
          activityName: selectedActivity.typeName,
          duration: parseInt(duration, 10),
          exertion,
          sessionLoad: Math.round(sessionLoad),
          loadLevel: result.loadLevel || 'Green',
          acuteLoad: result.acuteLoad || 0,
          chronicLoad: result.chronicLoad || 0,
          // ac_Ratio (Backend) ו-acRatio (אחר) — תמיכה בשני פורמטים
          acRatio: result.ac_Ratio || result.acRatio || 0,
          stressScore: result.stressScore || 0,
          recommendation:
            result.recommendationText ||
            'Good session! Keep up the consistent training.',
        },
      });
    } catch (error) {
      console.log('Submit error:', error.message);
      Alert.alert(
        'Error',
        'Could not save workout. Check your connection and try again.',
      );
    } finally {
      // סיום שליחה בכל מקרה — הסרת ספינר
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* כותרת המסך עם כפתור חזרה */}
      <ScreenHeader
        title="Add a Workout"
        subtitle="Log your training session"
        onBack={() => navigation.goBack()}
      />

      {/* גלילה עם כרטיסיות */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* כרטיסיית סוג הפעילות */}
        <Card>
          <Text style={styles.cardTitle}>Workout Type</Text>
          {/* ספינר בטעינה; ComboBox לאחר שהרשימה נטענה */}
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <ComboBox
              items={activityTypes}
              selectedValue={selectedActivity?.activityTypeID}
              onChange={(item) => setSelectedActivity(item)}
              labelKey="typeName"
              valueKey="activityTypeID"
              placeholder="Select workout type"
            />
          )}
        </Card>

        {/* כרטיסיית משך האימון */}
        <Card>
          <Text style={styles.cardTitle}>Session Duration (min)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 45"
            placeholderTextColor={Colors.textMuted}
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"    // מקלדת מספרים בלבד
          />
        </Card>

        {/* כרטיסיית רמת מאמץ — 10 נקודות ניתנות ללחיצה */}
        <Card>
          <Text style={styles.cardTitle}>Exertion Level: {exertion}/10</Text>
          {/* שורת נקודות הסיבוב — נקודות מלאות עד הערך הנבחר */}
          <View style={styles.severityRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.severityDot,
                  // הדגשת כל נקודה שערכה ≤ exertion הנוכחי
                  exertion >= val && styles.severityDotActive,
                ]}
                onPress={() => setExertion(val)}
              />
            ))}
          </View>
          {/* תוויות "Easy" ו-"Max Effort" בקצוות */}
          <View style={styles.severityLabels}>
            <Text style={styles.severityLabelText}>Easy</Text>
            <Text style={styles.severityLabelText}>Max Effort</Text>
          </View>
        </Card>

        {/* כרטיסיית מרחק (אופציונלי) */}
        <Card>
          <Text style={styles.cardTitle}>Distance (km)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 5.2"
            placeholderTextColor={Colors.textMuted}
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"   // תמיכה בנקודה עשרונית
          />
        </Card>

        {/* כרטיסיית דופק — שתי עמודות: ממוצע ומקסימלי */}
        <Card>
          <Text style={styles.cardTitle}>Pulse (bpm)</Text>
          <View style={styles.row}>
            {/* עמודה שמאלית: דופק ממוצע */}
            <View style={styles.halfCol}>
              <Text style={styles.label}>Average</Text>
              <TextInput
                style={styles.input}
                placeholder="avg"
                placeholderTextColor={Colors.textMuted}
                value={avgHeartRate}
                onChangeText={setAvgHeartRate}
                keyboardType="numeric"
              />
            </View>
            {/* עמודה ימנית: דופק מקסימלי */}
            <View style={styles.halfCol}>
              <Text style={styles.label}>Max</Text>
              <TextInput
                style={styles.input}
                placeholder="max"
                placeholderTextColor={Colors.textMuted}
                value={maxHeartRate}
                onChangeText={setMaxHeartRate}
                keyboardType="numeric"
              />
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* פס תחתון קבוע עם כפתור שמירה */}
      <View style={styles.bottomActions}>
        <PrimaryButton
          title="Apply"
          onPress={handleApply}
          loading={submitting}
        />
      </View>
    </View>
  );
};

// סגנונות המסך
const styles = StyleSheet.create({
  // מיכל ראשי — רקע כהה
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // ריפוד תחתון לגלילה כדי שהכפתור לא יכסה תוכן
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  // כותרת כרטיסייה — צבע מותג ומודגש
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  // שורת chip (לא בשימוש פעיל — נשמרה לעיצוב עתידי)
  chipRow: {
    paddingVertical: Spacing.sm,
  },
  chip: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
  chipTextSelected: {
    color: Colors.textPrimary,
    fontWeight: Fonts.bold,
  },
  // שדה קלט כללי
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    fontSize: Fonts.bodySize,
  },
  // שורת נקודות המאמץ
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
  },
  // נקודת מאמץ לא פעילה
  severityDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  // נקודת מאמץ פעילה — צבע מותג
  severityDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  // שורת תוויות Easy / Max Effort
  severityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  severityLabelText: {
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
  },
  // שורה המחלקת ל-2 עמודות
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // עמודה ב-50% רוחב
  halfCol: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  // תווית שדה קטנה
  label: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
    marginBottom: Spacing.xs,
  },
  // פס תחתון קבוע עם כפתור שמירה
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
});

export default AddWorkoutScreen;
