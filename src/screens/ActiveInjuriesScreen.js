// מסך פציעות פעילות — רשימת הפציעות הנוכחיות ואפשרות לסמן החלמה
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
// ייבוא צבעים, גופנים וריווחים מהתמה
import { Colors, Fonts, Spacing } from '../theme/colors';
// קומפוננטים משותפים
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
// פונקציות API לניהול פציעות
import {
  getAllInjuryTypes,        // שליפת כל סוגי הפציעות לתצוגת שם
  getActiveInjuriesByUser,  // שליפת הפציעות הפעילות של המשתמש
  markInjuryRecovered,      // סימון פציעה כמחלימה
} from '../services/api';
// userId מה-AuthContext
import { useAuth } from '../api/AuthContext';

const ActiveInjuriesScreen = ({ navigation }) => {
  // userId של המשתמש המחובר
  const { userId } = useAuth();
  // רשימת כל סוגי הפציעות (לתרגום ID → שם)
  const [injuryTypes, setInjuryTypes] = useState([]);
  // רשימת הפציעות הפעילות של המשתמש
  const [activeInjuries, setActiveInjuries] = useState([]);
  // האם הנתונים בטעינה
  const [loading, setLoading] = useState(true);
  // ID הפציעה שנמצאת בתהליך החלמה (להצגת spinner על הכפתור)
  const [recoveringId, setRecoveringId] = useState(null);

  // טוען גם את סוגי הפציעות וגם את הפציעות הפעילות במקביל
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Promise.all = שתי קריאות API מקביליות לחיסכון בזמן
      const [typesRes, activeRes] = await Promise.all([
        getAllInjuryTypes(),
        getActiveInjuriesByUser(userId),
      ]);
      setInjuryTypes(typesRes.data || []);
      setActiveInjuries(activeRes.data || []);
    } catch (error) {
      console.log('Failed to load active injuries:', error.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // טעינה ראשונית בעת עלייה המסך
  useEffect(() => {
    load();
  }, [load]);

  // ממיר injuryTypeID לשם ידידותי
  const injuryNameById = (id) => {
    const t = injuryTypes.find((i) => i.injuryTypeID === id);
    // אם לא נמצא — מציג מספר כברירת מחדל
    return t?.injuryName || `Injury #${id}`;
  };

  // מטפל בלחיצה על "Mark Recovered" — מבקש אישור לפני הפעולה
  const handleMarkRecovered = (injury) => {
    Alert.alert(
      'Mark as recovered?',
      'Your load thresholds will return to their normal range.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recovered',
          onPress: async () => {
            // מציג spinner על הכפתור הספציפי
            setRecoveringId(injury.injuryID);
            try {
              // קריאת API לסימון ההחלמה
              await markInjuryRecovered(injury.injuryID);
              Alert.alert('Recovered', 'Glad you are back! Thresholds reset.');
              // רענון הרשימה
              await load();
            } catch (error) {
              console.log('Recovery error:', error.message);
              Alert.alert('Error', 'Could not update injury status.');
            } finally {
              // ביטול ה-spinner
              setRecoveringId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* כותרת עם כפתור חזרה */}
      <ScreenHeader
        title="Active Injuries"
        subtitle="Mark recovered when healed"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          // מצב טעינה — spinner
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : activeInjuries.length === 0 ? (
          // אין פציעות פעילות
          <Card>
            <Text style={styles.emptyText}>No active injuries on file.</Text>
          </Card>
        ) : (
          // רשימת הפציעות
          <Card>
            {activeInjuries.map((inj, idx) => (
              <View
                key={inj.injuryID}
                style={[
                  styles.injuryRow,
                  // ללא גבול תחתון לשורה האחרונה
                  idx === activeInjuries.length - 1 && styles.lastRow,
                ]}
              >
                {/* פרטי הפציעה */}
                <View style={{ flex: 1 }}>
                  {/* שם הפציעה מתורגם מ-ID */}
                  <Text style={styles.injuryName}>
                    {injuryNameById(inj.injuryTypeID)}
                  </Text>
                  {/* חומרה ותאריך */}
                  <Text style={styles.injuryMeta}>
                    Severity {inj.severity}/10 ·{' '}
                    {new Date(inj.date).toLocaleDateString()}
                  </Text>
                </View>
                {/* כפתור סימון החלמה — spinner כשפציעה זו מתעדכנת */}
                <TouchableOpacity
                  style={styles.recoverBtn}
                  onPress={() => handleMarkRecovered(inj)}
                  disabled={recoveringId === inj.injuryID}
                >
                  {recoveringId === inj.injuryID ? (
                    <ActivityIndicator color={Colors.textPrimary} size="small" />
                  ) : (
                    <Text style={styles.recoverBtnText}>Mark Recovered</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
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
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  injuryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inputBorder,
  },
  lastRow: {
    borderBottomWidth: 0,  // ללא גבול תחתון לשורה האחרונה
  },
  injuryName: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.bold,
  },
  injuryMeta: {
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
    marginTop: 2,
  },
  recoverBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 18,
    minWidth: 130,
    alignItems: 'center',
  },
  recoverBtnText: {
    color: Colors.textPrimary,
    fontSize: Fonts.captionSize,
    fontWeight: Fonts.bold,
  },
});

export default ActiveInjuriesScreen;
