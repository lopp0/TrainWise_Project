// מסך Health Connect — סקירת אימונים, אישור רמת מאמץ, מחיקה
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
// אייקוני ✓, מחיקה, זמן וכדומה
import { Ionicons } from '@expo/vector-icons';
// useFocusEffect — רענון רשימה בכניסה לטאב
import { useFocusEffect } from '@react-navigation/native';
// userId של המשתמש המחובר
import { useAuth } from './AuthContext';
// פונקציות Context הסנכרון — הרשאות, סנכרון, עדכון badge
import { useHealthSync } from './HealthSyncContext';
// לוגי פעילות: שליפה, עדכון, מחיקה
import { getActivityLogs, putActivityLog, deleteActivityLog } from './api';
// חישוב עומס יומי לאחר שינוי
import { calculateDailyLoad } from '../services/api';
// צבעי ערכת הנושא
import { Colors } from '../theme/colors';
// tombstone — מניעת ייבוא חוזר של אימון שנמחק
import { tombstoneWorkout, loadHcTombstones } from '../constants/hcTombstones';

/**
 * GoogleFitScreen — מסך סקירת Health Connect.
 *
 * הסנכרון HC → Backend מתרחש אוטומטית ב-HealthSyncContext בעת פתיחת האפליקציה
 * ובכל חזרה לפורגראונד. מסך זה מציג את האימונים שנוצרו ומאפשר:
 *   - אישור כל אימון (קביעת רמת מאמץ) כדי שיחושב בעומס האימון
 *   - מחיקת אימון (+ tombstone כדי שלא יסונכרן שוב)
 *   - Pull-to-refresh ידני לסנכרון על דרישה
 */
const GoogleFitScreen = () => {
  // userId לשאילתות API
  const { userId } = useAuth();
  // פונקציות וסטטוס מה-HealthSyncContext
  const {
    permissionsGranted,       // האם הרשאות HC ניתנו
    requestHCPermissions,     // בקשת הרשאות (בפעם הראשונה)
    refreshUnconfirmedCount,  // עדכון badge של טאב Health
    runAutoSync,              // הפעלה ידנית של סנכרון
    isSyncing,                // האם סנכרון פעיל
    lastSyncError,            // שגיאת הסנכרון האחרון
  } = useHealthSync();

  // רשימת האימונים המוצגים
  const [workouts, setWorkouts] = useState([]);
  // האם בטעינת הרשימה מה-Backend
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false);
  // האם Pull-to-refresh פעיל
  const [refreshing, setRefreshing] = useState(false);
  // האימון שה-Modal הפתוח מתייחס אליו (null = Modal סגור)
  const [confirmingWorkout, setConfirmingWorkout] = useState(null);
  // רמת מאמץ שנבחרה ב-Modal (1-10)
  const [exertionLevel, setExertionLevel] = useState(5);
  // האם שמירת אישור בתהליך
  const [savingConfirm, setSavingConfirm] = useState(false);

  /**
   * loadWorkouts — שולף לוגי פעילות מה-Backend ומציגם ממוינים מהחדש לישן.
   */
  const loadWorkouts = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoadingWorkouts(true);
      const logs = await getActivityLogs(userId);
      // מיון מהחדש לישן לפי זמן התחלה
      const sorted = logs.sort(
        (a, b) => new Date(b.startTime) - new Date(a.startTime)
      );
      setWorkouts(sorted);
    } catch (err) {
      console.error('Error loading workouts:', err);
    } finally {
      setIsLoadingWorkouts(false);
    }
  }, [userId]);

  // רענון הרשימה בכל כניסה לטאב Health.
  // הסנכרון עצמו מנוהל ב-HealthSyncContext — אין צורך בכפתורים.
  useFocusEffect(
    useCallback(() => {
      // טעינת tombstones לפני הצגת הרשימה
      loadHcTombstones();
      loadWorkouts();
    }, [loadWorkouts])
  );

  /**
   * onRefresh — Pull-to-refresh: מריץ סנכרון HC → Backend ואז טוען מחדש.
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await runAutoSync();
      await loadWorkouts();
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * handleRequestPermissions — הגדרה חד-פעמית: בקשת הרשאות HC.
   * לאחר מתן הרשאות, מריץ סנכרון ראשוני ומציג את האימונים.
   */
  const handleRequestPermissions = async () => {
    const granted = await requestHCPermissions();
    if (granted) {
      Alert.alert('Connected', 'Health Connect permissions granted.');
      await runAutoSync();
      await loadWorkouts();
      return;
    }
    Alert.alert(
      'Health Connect',
      lastSyncError ||
        'Could not open Health Connect. Please make sure it is installed and up to date.'
    );
  };

  // מחיקת אימון — Alert אישור לפני מחיקה
  const handleDeleteWorkout = (workout) => {
    Alert.alert(
      'Delete workout?',
      'This permanently removes the workout from your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // מחיקת הלוג מה-Backend
              await deleteActivityLog(workout.activityID);
              // tombstone לאימוני HC בלבד — מניעת ייבוא חוזר בסנכרון הבא
              // אימונים ידניים לא מופיעים ב-HC, אז לא צריך tombstone עבורם
              if (workout.sourceDevice === 'Health Connect') {
                await tombstoneWorkout(workout);
              }
              try {
                // חישוב מחדש של עומס יום המחיקה + היום הנוכחי
                const sessionDate = new Date(workout.startTime);
                await calculateDailyLoad(userId, sessionDate);
                const today = new Date();
                if (sessionDate.toDateString() !== today.toDateString()) {
                  await calculateDailyLoad(userId, today);
                }
              } catch (recalcErr) {
                console.warn('Recalc failed:', recalcErr.message);
              }
              // רענון הרשימה + badge
              await loadWorkouts();
              await refreshUnconfirmedCount();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete workout.');
            }
          },
        },
      ],
    );
  };

  // פתיחת Modal לאישור אימון — רק אם לא מאושר כבר
  const openConfirmModal = (workout) => {
    if (workout.isConfirmed) return;
    setConfirmingWorkout(workout);
    // ברירת מחדל: רמת המאמץ הנוכחית של האימון (בד"כ 5 מ-HC)
    setExertionLevel(workout.exertionLevel || 5);
  };

  // סגירת Modal + איפוס סטטוס שמירה
  const closeConfirmModal = () => {
    setConfirmingWorkout(null);
    setSavingConfirm(false);
  };

  // שמירת האישור — PUT לוג עם exertionLevel חדש + isConfirmed=true
  const submitConfirm = async () => {
    if (!confirmingWorkout) return;
    try {
      setSavingConfirm(true);
      await putActivityLog({
        activityID: confirmingWorkout.activityID,
        activityTypeID: confirmingWorkout.activityTypeID,
        startTime: confirmingWorkout.startTime,
        endTime: confirmingWorkout.endTime,
        distanceKM: confirmingWorkout.distanceKM || 0,
        avgHeartRate: confirmingWorkout.avgHeartRate ?? null,
        maxHeartRate: confirmingWorkout.maxHeartRate ?? null,
        caloriesBurned: confirmingWorkout.caloriesBurned ?? null,
        sourceDevice: confirmingWorkout.sourceDevice || 'Health Connect',
        exertionLevel,              // הערך שבחר המשתמש ב-Modal
        duration: confirmingWorkout.duration || 0,
        isConfirmed: true,          // מאשר את האימון
      });
      closeConfirmModal();
      // רענון רשימה + badge
      await loadWorkouts();
      await refreshUnconfirmedCount();
      Alert.alert('Workout Confirmed', 'Exertion level saved. Your training load will update on next refresh.');
    } catch (err) {
      setSavingConfirm(false);
      Alert.alert('Error', err.message || 'Failed to confirm workout');
    }
  };

  // פורמט שעה: "2:30 PM" בזמן ישראל
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Jerusalem',
      });
    } catch {
      return 'N/A';
    }
  };

  // פורמט תאריך: "Jan 15, 2025" בזמן ישראל
  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Jerusalem',
      });
    } catch {
      return 'N/A';
    }
  };

  // מיפוי activityTypeID → שם קריא
  const getActivityTypeName = (typeId) => {
    const types = {
      1: 'Running',
      2: 'Walking',
      3: 'Cycling',
      4: 'Weightlifting',
      5: 'Other',
    };
    return types[typeId] || 'Unknown';
  };

  /**
   * renderWorkoutItem — רנדור כרטיסיית אימון יחידה.
   * לחיצה פותחת את Modal האישור (רק לאימונים ממתינים).
   */
  const renderWorkoutItem = ({ item }) => {
    const duration = item.duration || 0;
    const calories = item.caloriesBurned || 0;
    const distance = item.distanceKM || 0;
    const activityName = getActivityTypeName(item.activityTypeID);

    return (
      <TouchableOpacity
        style={styles.workoutCard}
        onPress={() => openConfirmModal(item)}
        // אימון מאושר: לא ניתן ללחיצה (opacity=1 מונע אנימציה)
        activeOpacity={item.isConfirmed ? 1 : 0.7}
      >
        {/* כותרת הכרטיסייה: סוג פעילות + תאריך */}
        <View style={styles.workoutHeader}>
          <Text style={styles.activityName}>{activityName}</Text>
          <Text style={styles.workoutDate}>
            {formatDate(item.startTime)} • {formatTime(item.startTime)}
          </Text>
        </View>

        {/* שורת סטטיסטיקות — מציגה רק ערכים > 0 */}
        <View style={styles.workoutStats}>
          {/* משך — תמיד מוצג */}
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.statText}>{duration} min</Text>
          </View>

          {/* מרחק — מוצג רק אם > 0 */}
          {distance > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="map-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.statText}>{distance.toFixed(1)} km</Text>
            </View>
          )}

          {/* קלוריות — מוצג רק אם > 0 */}
          {calories > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="flame-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.statText}>{Math.round(calories)} cal</Text>
            </View>
          )}

          {/* דופק — מוצג רק אם > 0 */}
          {item.avgHeartRate > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="heart-outline" size={16} color="#e74c3c" />
              <Text style={styles.statText}>
                {Math.round(item.avgHeartRate)} bpm
              </Text>
            </View>
          )}
        </View>

        {/* תחתית הכרטיסייה: badge סטטוס + מקור */}
        <View style={styles.workoutFooter}>
          {/* badge: Confirmed (ירוק) / Pending (כתום) */}
          <View
            style={[
              styles.statusBadge,
              item.isConfirmed ? styles.confirmed : styles.unconfirmed,
            ]}
          >
            <Ionicons
              name={item.isConfirmed ? 'checkmark-circle' : 'time-outline'}
              size={14}
              color={item.isConfirmed ? '#27ae60' : '#f39c12'}
            />
            <Text
              style={[
                styles.statusText,
                item.isConfirmed ? styles.confirmedText : styles.unconfirmedText,
              ]}
            >
              {item.isConfirmed ? 'Confirmed' : 'Pending'}
            </Text>
          </View>

          {/* מקור האימון (Health Connect / Manual) */}
          <Text style={styles.sourceText}>📲 {item.sourceDevice}</Text>
        </View>

        {/* כפתור מחיקה — שורה נפרדת עם גבול אדום */}
        <TouchableOpacity
          style={styles.deleteRowBtn}
          onPress={() => handleDeleteWorkout(item)}
        >
          <Ionicons name="trash-outline" size={16} color="#e74c3c" />
          <Text style={styles.deleteRowBtnText}>Delete</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Modal אישור אימון — בחירת רמת מאמץ 1-10
  const renderConfirmModal = () => (
    <Modal
      visible={!!confirmingWorkout}
      transparent
      animationType="fade"
      onRequestClose={closeConfirmModal}
    >
      {/* רקע overlay */}
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Confirm Workout</Text>
          {/* פרטי האימון המאושר */}
          {confirmingWorkout && (
            <Text style={styles.modalSubtitle}>
              {getActivityTypeName(confirmingWorkout.activityTypeID)} •{' '}
              {formatDate(confirmingWorkout.startTime)} •{' '}
              {formatTime(confirmingWorkout.startTime)}
            </Text>
          )}

          {/* שאלת רמת מאמץ */}
          <Text style={styles.modalLabel}>How hard was it? (1–10)</Text>
          {/* 10 כפתורי בחירה — chip עגול */}
          <View style={styles.exertionRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
              const selected = n === exertionLevel;
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => setExertionLevel(n)}
                  style={[
                    styles.exertionChip,
                    selected && styles.exertionChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.exertionChipText,
                      selected && styles.exertionChipTextSelected,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* כפתורי Cancel + Confirm */}
          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, styles.modalButton]}
              onPress={closeConfirmModal}
              disabled={savingConfirm}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, styles.modalButton]}
              onPress={submitConfirm}
              disabled={savingConfirm}
            >
              {/* ספינר בזמן שמירה */}
              {savingConfirm ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Confirm</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // מצב ריק — מוצג כשאין אימונים
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="fitness-outline" size={64} color="#bdc3c7" />
      <Text style={styles.emptyText}>No workouts yet</Text>
      <Text style={styles.emptySubtext}>
        Connect Health Connect and sync your workouts to see them here
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* כותרת + אינדיקטור חיבור */}
      <View style={styles.header}>
        <Text style={styles.title}>Health Connect</Text>

        {/* נקודת מצב: Connected (ירוק) / Not Connected (אדום) */}
        <View
          style={[
            styles.statusIndicator,
            permissionsGranted ? styles.connected : styles.disconnected,
          ]}
        >
          <Ionicons
            name={permissionsGranted ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={permissionsGranted ? '#27ae60' : '#e74c3c'}
          />
          <Text
            style={[
              styles.statusIndicatorText,
              permissionsGranted ? styles.connectedText : styles.disconnectedText,
            ]}
          >
            {permissionsGranted ? 'Connected' : 'Not Connected'}
          </Text>
        </View>
      </View>

      {/* באנר שגיאת סנכרון — מוצג כשיש שגיאה מהסנכרון האחרון */}
      {lastSyncError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={20} color="#e74c3c" />
          <Text style={styles.errorText}>{lastSyncError}</Text>
        </View>
      )}

      {/* כפתור חיבור ראשוני — מוצג רק כשאין הרשאות */}
      {!permissionsGranted && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleRequestPermissions}
            disabled={isSyncing}
          >
            {/* ספינר בזמן בקשת הרשאות */}
            {isSyncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="link-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Connect Health Connect</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* באנר הנחיה למשתמש מחובר */}
      {permissionsGranted && (
        <View style={styles.hintBanner}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.hintText}>
            New workouts sync automatically. Tap a Pending workout to confirm it.
          </Text>
        </View>
      )}

      {/* Modal אישור */}
      {renderConfirmModal()}

      {/* רשימת האימונים — Pull-to-refresh מריץ סנכרון */}
      <FlatList
        data={workouts}
        // מפתח: activityID או random (מניעת crash אם חסר ID)
        keyExtractor={(item) => item.activityID?.toString() || Math.random().toString()}
        renderItem={renderWorkoutItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
    </View>
  );
};

// ============================================================================
// סגנונות המסך
// ============================================================================

const styles = StyleSheet.create({
  // מיכל ראשי
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // כותרת עליונה — רקע כרטיסייה
  header: {
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 12,
  },

  // אינדיקטור חיבור — pill עגול
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },

  // Connected — רקע ירוק חצי-שקוף
  connected: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },

  // Not Connected — רקע אדום חצי-שקוף
  disconnected: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },

  statusIndicatorText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },

  connectedText: {
    color: Colors.success,
  },

  disconnectedText: {
    color: Colors.danger,
  },

  // שמור לשימוש עתידי — lastSync
  lastSyncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.cardBackgroundLight,
    marginHorizontal: 0,
    marginTop: 8,
  },

  lastSyncText: {
    marginLeft: 8,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // באנר שגיאה
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginTop: 8,
  },

  errorText: {
    marginLeft: 12,
    fontSize: 13,
    color: Colors.danger,
    flex: 1,
  },

  // באנר הצלחה — שמור לשימוש עתידי
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginTop: 8,
  },

  successText: {
    marginLeft: 12,
    fontSize: 13,
    color: Colors.success,
    fontWeight: '500',
  },

  // באנר הנחיה — אפור עדין
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.cardBackgroundLight,
  },

  hintText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // מיכל כפתור חיבור
  buttonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.cardBackground,
    gap: 10,
  },

  // כפתור בסיסי
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 10,
  },

  // כפתור ראשי — צבע מותג
  primaryButton: {
    backgroundColor: Colors.primary,
  },

  buttonText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  // כפתור משני — רקע בהיר + מסגרת
  secondaryButton: {
    backgroundColor: Colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },

  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },

  // FlatList
  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },

  // כרטיסיית אימון — גבול שמאלי בצבע מותג
  workoutCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },

  // כותרת כרטיסייה
  workoutHeader: {
    marginBottom: 10,
  },

  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },

  workoutDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // שורת סטטיסטיקות
  workoutStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },

  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  statText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // תחתית כרטיסייה
  workoutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },

  // badge מצב (Confirmed/Pending)
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },

  confirmed: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },

  unconfirmed: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
  },

  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  confirmedText: {
    color: Colors.success,
  },

  unconfirmedText: {
    color: Colors.warning,
  },

  sourceText: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  // מצב ריק
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 16,
  },

  emptySubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Modal אישור
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  modalCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },

  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },

  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },

  // שורת chip רמת מאמץ
  exertionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },

  // chip רמת מאמץ
  exertionChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // chip נבחר — צבע מותג
  exertionChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  exertionChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  exertionChipTextSelected: {
    color: Colors.textPrimary,
  },

  // שורת כפתורי Modal
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },

  modalButton: {
    flex: 1,
  },

  // כפתור מחיקה — שורה נפרדת תחת הכרטיסייה
  deleteRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e74c3c',
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
  },

  deleteRowBtnText: {
    color: '#e74c3c',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default GoogleFitScreen;
