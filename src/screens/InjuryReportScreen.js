// מסך דיווח פציעה — הגשת דוח פציעה חדש עם סוג, חומרה והערות
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
// Ionicons לאייקון חץ בכרטיס הפציעות הפעילות
import { Ionicons } from '@expo/vector-icons';
// ייבוא צבעים, גופנים וריווחים מהתמה
import {Colors, Fonts, Spacing} from '../theme/colors';
// קומפוננטים משותפים
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import ComboBox from '../components/ComboBox';
// פונקציות API לפציעות
import {
  getAllInjuryTypes,        // שליפת כל סוגי הפציעות לרשימה
  createInjuryReport,       // יצירת דוח פציעה חדש
  getActiveInjuriesByUser,  // ספירת פציעות פעילות לתצוגה בכרטיס
} from '../services/api';
// userId מה-AuthContext
import { useAuth } from '../api/AuthContext';


const InjuryReportScreen = ({navigation}) => {
  // userId של המשתמש המחובר
  const { userId } = useAuth();
  // רשימת סוגי הפציעות לבחירה
  const [injuryTypes, setInjuryTypes] = useState([]);
  // הפציעה הנבחרת בComboBox
  const [selectedInjury, setSelectedInjury] = useState(null);
  // רמת חומרה (1-10), ברירת מחדל 5
  const [severity, setSeverity] = useState(5);
  // הערות / המלצת רופא
  const [notes, setNotes] = useState('');
  // האם סוגי הפציעות בטעינה
  const [loading, setLoading] = useState(false);
  // האם ההגשה בתהליך
  const [submitting, setSubmitting] = useState(false);
  // ספירת פציעות פעילות לתצוגה בכרטיס הניווט
  const [activeCount, setActiveCount] = useState(0);

  // טעינה ראשונית — סוגי פציעות + ספירת פעילות
  useEffect(() => {
    loadInjuryTypes();
    loadActiveCount();
  }, []);

  // רענון ספירת פציעות פעילות בכל פעם שהמסך מקבל פוקוס
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadActiveCount);
    // ניקוי ה-listener כשהקומפוננט מתפרק
    return unsub;
  }, [navigation]);

  // שליפת ספירת הפציעות הפעילות לתצוגה בכרטיס הניווט
  const loadActiveCount = async () => {
    if (!userId) return;
    try {
      const response = await getActiveInjuriesByUser(userId);
      setActiveCount((response.data || []).length);
    } catch (error) {
      console.log('Failed to load active injuries:', error.message);
      setActiveCount(0);
    }
  };

  // שליפת כל סוגי הפציעות לרשימת הבחירה
  const loadInjuryTypes = async () => {
    setLoading(true);
    try {
      const response = await getAllInjuryTypes();
      setInjuryTypes(response.data || []);
    } catch (error) {
      console.log('Failed to load injury types:', error.message);
      // ברירת מחדל אם השרת לא זמין
      setInjuryTypes([
        {injuryTypeID: 1, injuryName: 'Knee Pain'},
        {injuryTypeID: 2, injuryName: 'Shin Splints'},
        {injuryTypeID: 3, injuryName: 'Lower Back Pain'},
        {injuryTypeID: 4, injuryName: 'Ankle Sprain'},
        {injuryTypeID: 5, injuryName: 'Shoulder Strain'},
      ]);
    } finally {
      setLoading(false);
    }
  };

  // הגשת דוח הפציעה לשרת
  const handleSubmit = async () => {
    // וידוא שנבחר סוג פציעה
    if (!selectedInjury) {
      Alert.alert('Missing Info', 'Please select an injury type');
      return;
    }

    setSubmitting(true);
    try {
      // יצירת הדוח בשרת
      await createInjuryReport({
        userID: userId,
        injuryTypeID: selectedInjury.injuryTypeID,
        date: new Date().toISOString().split('T')[0],  // פורמט YYYY-MM-DD
        severity: severity,
        notes: notes,
        isActiveInjury: true,   // פציעה חדשה היא תמיד פעילה
      });
      Alert.alert(
        'Report Submitted',
        'Your injury has been recorded. The app will adjust your load thresholds accordingly.',
      );
      // איפוס הטופס
      setSelectedInjury(null);
      setSeverity(5);
      setNotes('');
      // רענון ספירת הפציעות הפעילות
      await loadActiveCount();
    } catch (error) {
      console.log('Submit error:', error.message);
      Alert.alert('Error', 'Could not submit injury report. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* כותרת עם כפתור חזרה */}
      <ScreenHeader
        title="Injury Report"
        subtitle="Record a new injury"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* כרטיס ניווט לרשימת הפציעות הפעילות */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ActiveInjuries')}
        >
          <Card>
            <View style={styles.activeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Active Injuries</Text>
                {/* מציג כמה פציעות פעילות יש, או הודעה שאין */}
                <Text style={styles.activeMeta}>
                  {activeCount === 0
                    ? 'No active injuries on file'
                    : `${activeCount} active${activeCount === 1 ? '' : ' injuries'} — tap to manage`}
                </Text>
              </View>
              {/* חץ ניווט */}
              <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>

        {/* כרטיס בחירת סוג פציעה */}
        <Card>
          <Text style={styles.cardTitle}>Injury Type</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <ComboBox
              items={injuryTypes}
              selectedValue={selectedInjury?.injuryTypeID}
              onChange={(item) => setSelectedInjury(item)}
              labelKey="injuryName"
              valueKey="injuryTypeID"
              placeholder="Select injury type"
            />
          )}
        </Card>

        {/* כרטיס בחירת חומרה — עיגולים 1-10 */}
        <Card>
          <Text style={styles.cardTitle}>Severity: {severity}/10</Text>
          <View style={styles.severityRow}>
            {/* עיגול לכל רמת חומרה — עיגולים עד הערך הנבחר מלאים */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.severityDot,
                  severity >= val && styles.severityDotActive,
                ]}
                onPress={() => setSeverity(val)}
              />
            ))}
          </View>
          {/* תוויות קצוות הסקאלה */}
          <View style={styles.severityLabels}>
            <Text style={styles.severityLabelText}>Mild</Text>
            <Text style={styles.severityLabelText}>Severe</Text>
          </View>
        </Card>

        {/* כרטיס הערות רופא */}
        <Card>
          <Text style={styles.cardTitle}>Doctor Recommendation / Notes</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe symptoms or medical advice..."
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={5}
            textAlignVertical="top"  // טקסט מתחיל מהראש (Android)
          />
        </Card>
      </ScrollView>

      {/* כפתור הגשת הדוח */}
      <View style={styles.bottomActions}>
        <PrimaryButton
          title="Submit Report"
          onPress={handleSubmit}
          loading={submitting}
        />
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
  // שורת הכרטיס הניווטי (פציעות פעילות)
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeMeta: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
  // שורת עיגולי החומרה
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
  },
  severityDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  // עיגול פעיל — בצבע מותג
  severityDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  severityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  severityLabelText: {
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
  },
  // אזור טקסט עבור הערות
  textArea: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    minHeight: 100,
    fontSize: Fonts.bodySize,
  },
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
});

export default InjuryReportScreen;
