// Hook לניהול סנכרון Health Connect — state, הרשאות ופעולות סנכרון
import { useState, useCallback, useRef } from 'react';
// userId ו-deviceId מה-AuthContext
import { useAuth } from './AuthContext';
// הפונקציה הראשית לסנכרון HC → Backend
import { syncWorkoutsToBackend } from './SyncService';
// פונקציות HC לבדיקת ובקשת הרשאות
import {
  requestPermissions,
  checkPermissions,
  initializeHealthConnect,
} from './HealthConnectService';

// מספר ההרשאות הנדרשות (ExerciseSession, HeartRate, Distance, ActiveCalories, TotalCalories)
const REQUIRED_PERM_COUNT = 5;

// ממיר שגיאת הרשאות לטקסט ידידותי למשתמש
const classifyPermissionError = (err) => {
  const msg = (err && err.message) || '';
  // בדיקת מילות מפתח בהודעת השגיאה
  if (/not available|SDK|unavailable/i.test(msg)) {
    return 'Health Connect is not available on this device.';
  }
  if (/denied|revoked|rejected/i.test(msg)) {
    return 'Permissions were denied. Please grant them in Health Connect settings.';
  }
  return 'Could not open Health Connect. Please make sure it is installed and up to date.';
};

/**
 * useSyncWorkouts
 *
 * Hook המאחד לוגיקת סנכרון HC ומנהל את ה-state שלה.
 * מספק: isSyncing, triggerSync, requestHCPermissions, checkHCPermissions ועוד.
 */
export const useSyncWorkouts = () => {
  // userId ו-deviceId של המשתמש המחובר
  const { userId, deviceId } = useAuth();

  // האם סנכרון בתהליך כרגע
  const [isSyncing, setIsSyncing] = useState(false);
  // זמן הסנכרון האחרון המוצלח
  const [lastSyncTime, setLastSyncTime] = useState(null);
  // תוצאת הסנכרון האחרון
  const [syncResult, setSyncResult] = useState(null);
  // הודעת שגיאה אחרונה
  const [error, setError] = useState(null);
  // האם הרשאות HC ניתנו
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // מונה ניסיונות סנכרון — ref כדי לא לגרום re-render
  const syncAttempts = useRef(0);

  /**
   * requestHCPermissions — מציג למשתמש בקשת הרשאות Health Connect.
   * @returns {Promise<boolean>} true אם כל ההרשאות ניתנו
   */
  const requestHCPermissions = useCallback(async () => {
    try {
      setError(null);
      console.log('[useSyncWorkouts] step 1: initializeHealthConnect');
      // אתחול מודול HC — בודק שה-SDK זמין
      const isAvailable = await initializeHealthConnect();
      if (!isAvailable) {
        setError('Health Connect is not available on this device.');
        setPermissionsGranted(false);
        return false;
      }

      console.log('[useSyncWorkouts] step 2: requestPermissions');
      // בקשת הרשאות — פותח את מסך הרשאות HC
      const permResult = await requestPermissions();
      console.log('[useSyncWorkouts] step 3: granted =', permResult.granted);

      // בדיקה שהתקבלו מספיק הרשאות
      const allGranted =
        Array.isArray(permResult.granted) &&
        permResult.granted.length >= REQUIRED_PERM_COUNT;
      setPermissionsGranted(allGranted);

      if (!allGranted) {
        setError('Permissions were denied. Please grant them in Health Connect settings.');
        return false;
      }

      console.log('[useSyncWorkouts] ✓ all permissions granted');
      return true;
    } catch (err) {
      console.error('[useSyncWorkouts] requestHCPermissions error:', err);
      setError(classifyPermissionError(err));
      setPermissionsGranted(false);
      return false;
    }
  }, []);

  /**
   * checkHCPermissions — בדיקה אם ההרשאות כבר קיימות (ללא הצגת dialog).
   * @returns {Promise<boolean>} true אם כל ההרשאות קיימות
   */
  const checkHCPermissions = useCallback(async () => {
    try {
      const permStatus = await checkPermissions();
      // בדיקה שיש לפחות 5 הרשאות
      const allGranted = permStatus.granted.length >= 5;
      setPermissionsGranted(allGranted);
      return allGranted;
    } catch (err) {
      console.error('Error checking permissions:', err);
      setPermissionsGranted(false);
      return false;
    }
  }, []);

  /**
   * triggerSync — מפעיל את תהליך הסנכרון המלא.
   * דורש userId ו-deviceId מה-AuthContext.
   * @param {number} lookbackDays - מספר ימים לאחור לסנכרון (ברירת מחדל 7)
   */
  const triggerSync = useCallback(
    async (lookbackDays = 7) => {
      try {
        // וידוא שיש משתמש ומכשיר מחובר
        if (!userId || !deviceId) {
          throw new Error(
            'User ID or Device ID not available. Please ensure user is logged in.'
          );
        }

        // סימון תחילת סנכרון
        setIsSyncing(true);
        setError(null);
        setSyncResult(null);
        // הגדלת מונה הניסיונות
        syncAttempts.current += 1;

        console.log(`[Sync #${syncAttempts.current}] Starting sync...`);

        // הפעלת הסנכרון הראשי
        const result = await syncWorkoutsToBackend(userId, deviceId, lookbackDays);

        setSyncResult(result);

        if (result.success) {
          // עדכון זמן הסנכרון האחרון
          setLastSyncTime(new Date());
          console.log(`✓ Sync successful: ${result.synced} workouts synced`);
        } else {
          // חילוץ שגיאה ראשונה מהתוצאה
          const errorMsg =
            result.errors?.[0]?.error || 'Sync completed with errors';
          setError(errorMsg);
          console.error('Sync failed:', errorMsg);
        }

        return result;
      } catch (err) {
        // שגיאה כללית — יצירת תוצאת כישלון
        const errorMsg = err.message || 'Sync failed';
        setError(errorMsg);
        setSyncResult({
          success: false,
          synced: 0,
          skipped: 0,
          errors: [{ step: 'general', error: errorMsg }],
          workouts: [],
        });
        console.error('Sync error:', err);

        return {
          success: false,
          synced: 0,
          skipped: 0,
          errors: [{ step: 'general', error: errorMsg }],
          workouts: [],
        };
      } finally {
        // בכל מקרה — סימון סיום סנכרון
        setIsSyncing(false);
      }
    },
    [userId, deviceId]
  );

  // איפוס תוצאת הסנכרון ושגיאה ללא איפוס מצב ההרשאות
  const clearSyncState = useCallback(() => {
    setSyncResult(null);
    setError(null);
  }, []);

  // איפוס מלא של כל ה-state לערכי ברירת מחדל
  const resetSync = useCallback(() => {
    setIsSyncing(false);
    setLastSyncTime(null);
    setSyncResult(null);
    setError(null);
    setPermissionsGranted(false);
    syncAttempts.current = 0;
  }, []);

  // החזרת כל ה-state והפונקציות לשימוש בקומפוננטים
  return {
    // State
    isSyncing,              // האם סנכרון פעיל
    lastSyncTime,           // זמן סנכרון אחרון
    syncResult,             // תוצאת סנכרון אחרון
    error,                  // שגיאה אחרונה
    permissionsGranted,     // האם יש הרשאות HC
    syncAttempts: syncAttempts.current, // מספר ניסיונות

    // Methods
    triggerSync,            // הפעלת סנכרון
    requestHCPermissions,   // בקשת הרשאות
    checkHCPermissions,     // בדיקת הרשאות קיימות
    clearSyncState,         // ניקוי תוצאה ושגיאה
    resetSync,              // איפוס מלא
  };
};

export default useSyncWorkouts;
