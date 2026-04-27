// SyncService — אורקסטרציה של תהליך הסנכרון בין Health Connect ל-Backend
import {
  getStructuredWorkouts,   // שליפת אימונים מ-HC בפורמט מובנה
  initializeHealthConnect, // אתחול מודול HC
  checkPermissions,        // בדיקת הרשאות קיימות
  requestPermissions,      // בקשת הרשאות מהמשתמש
} from './HealthConnectService';
import {
  postActivityLog,         // יצירת לוג פעילות ב-Backend
  getActivityLogs,         // שליפת לוגים קיימים מה-Backend
  putUserDevice,           // עדכון lastSync של המכשיר
} from './api';
// טעינה ובדיקת tombstone — אימונים שנמחקו לא יסונכרנו שוב
import { loadHcTombstones, isTombstoned } from '../constants/hcTombstones';

/**
 * SyncService
 *
 * מנהל את תהליך הסנכרון המלא בין Health Connect ל-Backend של TrainWise.
 * מטפל בכפילויות, שגיאות וניהול זמן סנכרון של מכשיר.
 */

/**
 * מחשב טווח תאריכים של N ימים אחורה מהיום.
 *
 * @param {number} days - מספר הימים לאחור
 * @returns {Object} { startDate: Date, endDate: Date }
 */
const getDateRangeForDays = (days = 7) => {
  // זמן הסיום = עכשיו
  const endDate = new Date();
  const startDate = new Date();
  // זמן ההתחלה = לפני N ימים
  startDate.setDate(startDate.getDate() - days);

  return { startDate, endDate };
};

/**
 * בדיקה האם שני אימונים זהים לפי זמן התחלה.
 * משתמשת בסבלנות של דקה אחת לטיפול בהפרשי זמן קלים.
 *
 * @param {Object} hcWorkout - אימון מ-Health Connect
 * @param {Object} existingLog - לוג קיים מה-Backend
 * @returns {boolean} true אם האימונים תואמים
 */
const areWorkoutsDuplicate = (hcWorkout, existingLog) => {
  // Backend מחזיר DateTime ללא Z (Kind=Unspecified) — new Date() מפרש אותו
  // כשעון מקומי; HC שולח UTC עם Z — פער של 2-3 שעות גורם להחמצת כל ההתאמות.
  // פתרון: השוואה של החלק "שעון הקיר" ברזולוציית דקה (16 תווים ראשונים).
  const normalize = (t) => String(t || '').replace(/Z$/, '').slice(0, 16);
  return normalize(hcWorkout.startTime) === normalize(existingLog.startTime);
};

/**
 * מסנן אימונים שכבר קיימים ב-Backend ואימונים עם tombstone.
 *
 * @param {Array} healthConnectWorkouts - אימונים מ-Health Connect
 * @param {Array} existingLogs - לוגים קיימים מה-Backend
 * @returns {Object} { new: Array, duplicates: Array, tombstoned: Array }
 */
const deduplicateWorkouts = (healthConnectWorkouts, existingLogs) => {
  const newWorkouts = [];    // אימונים חדשים שיש לסנכרן
  const duplicates = [];     // אימונים שכבר קיימים
  const tombstoned = [];     // אימונים שנמחקו ולא יסונכרנו

  healthConnectWorkouts.forEach((hcWorkout) => {
    // בדיקת tombstone: אם המשתמש מחק אימון זה מהאפליקציה —
    // HC עדיין שומר אותו, אבל אנחנו לא נייבא אותו שוב.
    // ללא זה, כל סנכרון יחדש את השורה שנמחקה.
    if (isTombstoned(hcWorkout)) {
      tombstoned.push(hcWorkout);
      return;
    }

    // בדיקה אם הלוג כבר קיים בפי-Backend לפי זמן התחלה
    const isDuplicate = existingLogs.some((log) =>
      areWorkoutsDuplicate(hcWorkout, log)
    );

    if (isDuplicate) {
      duplicates.push(hcWorkout);
    } else {
      newWorkouts.push(hcWorkout);
    }
  });

  return { new: newWorkouts, duplicates, tombstoned };
};

/**
 * שולח אימון בודד ל-Backend.
 *
 * @param {Object} workout - אימון מובנה לשליחה
 * @returns {Promise<Object>} { success: boolean, data?: Object, error?: string }
 */
const postWorkout = async (workout) => {
  try {
    const result = await postActivityLog(workout);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error posting workout:', error);
    return {
      success: false,
      error: error.message || 'Failed to post workout',
    };
  }
};

/**
 * מעדכן את זמן הסנכרון האחרון של המכשיר.
 *
 * @param {number} userId - מזהה המשתמש
 * @param {number} deviceId - מזהה המכשיר (Backend row ID)
 * @returns {Promise<boolean>} true אם העדכון הצליח
 */
const updateDeviceLastSync = async (userId, deviceId) => {
  // deviceId שנוצר מקומית (לדוגמה: "dev-1234-abc") אינו שורה ב-Backend —
  // מדלגים על הקריאה כדי למנוע שגיאת 404
  if (!deviceId || typeof deviceId !== 'number') {
    return true;
  }
  try {
    const deviceData = {
      lastSync: new Date().toISOString(),   // זמן הסנכרון הנוכחי
      permissionsGranted: true,
    };

    await putUserDevice(userId, deviceId, deviceData);
    return true;
  } catch (error) {
    // כישלון בעדכון lastSync לא חוסם את הסנכרון עצמו
    console.log('Skipping device lastSync update:', error.message);
    return false;
  }
};

/**
 * syncWorkoutsToBackend — הפונקציה הראשית לסנכרון.
 * מתזמרת את כל תהליך הסנכרון:
 * 1. אתחול Health Connect
 * 2. בדיקת/בקשת הרשאות
 * 3. שליפת אימונים מ-HC
 * 4. שליפת לוגים קיימים מ-Backend
 * 5. סינון כפילויות
 * 6. שליחת אימונים חדשים
 * 7. עדכון lastSync של המכשיר
 *
 * @param {number} userId - מזהה המשתמש (חובה)
 * @param {number} deviceId - מזהה המכשיר (חובה)
 * @param {number} lookbackDays - מספר ימים לסנכרון (ברירת מחדל 7)
 *
 * @returns {Promise<Object>} סיכום הסנכרון:
 *   { success, synced, skipped, errors, workouts }
 */
export const syncWorkoutsToBackend = async (
  userId,
  deviceId,
  lookbackDays = 7
) => {
  // אובייקט תוצאה — מאוכלס לאורך התהליך
  const result = {
    success: false,
    synced: 0,          // כמה אימונים סונכרנו בהצלחה
    skipped: 0,         // כמה דולגו (כפילויות + tombstones)
    errors: [],         // שגיאות שנאספו
    workouts: [],       // אובייקטי האימונים שנוצרו
  };

  try {
    // וידוא שהפרמטרים הנדרשים קיימים
    if (!userId || !deviceId) {
      throw new Error('userId and deviceId are required');
    }

    console.log(
      `Starting sync for user ${userId}, device ${deviceId}, lookback ${lookbackDays} days`
    );

    // שלב 1: וידוא שה-SDK של Health Connect זמין
    console.log('Step 1: Initializing Health Connect...');
    const isAvailable = await initializeHealthConnect();
    if (!isAvailable) {
      throw new Error('Health Connect is not available on this device');
    }

    // שלב 2: בדיקת הרשאות; אם חסרות — בקשה מהמשתמש
    console.log('Step 2: Checking permissions...');
    let permStatus = await checkPermissions();
    let allGranted =
      permStatus.granted.length >= permStatus.permissions.length;

    if (!allGranted) {
      // פתיחת מסך ההרשאות של Health Connect
      console.log('Step 2a: Permissions missing, prompting user...');
      const prompted = await requestPermissions();
      permStatus = prompted;
      allGranted = prompted.granted.length >= prompted.permissions.length;
    }

    // אם עדיין אין הרשאות — מפסיקים את הסנכרון
    if (!allGranted) {
      throw new Error('Permissions were denied. Please grant them in Health Connect settings.');
    }

    // שלב 3: שליפת אימונים מ-Health Connect לטווח הזמן הנבחר
    console.log('Step 3: Fetching workouts from Health Connect...');
    const { startDate, endDate } = getDateRangeForDays(lookbackDays);
    const healthConnectWorkouts = await getStructuredWorkouts(startDate, endDate);

    if (!healthConnectWorkouts || healthConnectWorkouts.length === 0) {
      console.log('No workouts found in Health Connect');
      result.success = true;
      result.synced = 0;
      result.skipped = 0;

      // גם ללא אימונים — מעדכנים זמן הסנכרון
      await updateDeviceLastSync(userId, deviceId);
      return result;
    }

    console.log(`Found ${healthConnectWorkouts.length} workouts in Health Connect`);

    // שלב 4: שליפת לוגים קיימים מה-Backend לצורך סינון כפילויות
    console.log('Step 4: Fetching existing activity logs from backend...');
    const existingLogs = await getActivityLogs(userId);
    console.log(`Found ${existingLogs.length || 0} existing logs in backend`);

    // שלב 5: סינון כפילויות — כולל טעינת tombstones מ-AsyncStorage
    console.log('Step 5: Deduplicating workouts...');
    await loadHcTombstones();
    const { new: newWorkouts, duplicates, tombstoned } = deduplicateWorkouts(
      healthConnectWorkouts,
      existingLogs || []
    );

    // סך הכול דולגו = כפילויות + tombstones
    result.skipped = duplicates.length + tombstoned.length;
    console.log(`${newWorkouts.length} new workouts to sync, ${duplicates.length} duplicates, ${tombstoned.length} tombstoned`);

    // שלב 6: שליחת אימונים חדשים ל-Backend אחד-אחד
    console.log('Step 6: Posting new workouts to backend...');
    for (const workout of newWorkouts) {
      // הוספת userId לכל אימון לפני השליחה
      workout.userID = userId;

      const postResult = await postWorkout(workout);

      if (postResult.success) {
        result.synced++;
        result.workouts.push(postResult.data);
        console.log('✓ Posted workout:', workout.startTime);
      } else {
        // שגיאה בשליחה אחת לא עוצרת את שאר האימונים
        result.errors.push({
          workout: workout.startTime,
          error: postResult.error,
        });
        console.error('✗ Failed to post workout:', workout.startTime, postResult.error);
      }
    }

    // שלב 7: עדכון lastSync של המכשיר ב-Backend
    console.log('Step 7: Updating device last sync timestamp...');
    const deviceUpdateSuccess = await updateDeviceLastSync(userId, deviceId);

    if (!deviceUpdateSuccess) {
      // אזהרה בלבד — לא מכשיל את כל הסנכרון
      result.errors.push({
        step: 'updateDeviceLastSync',
        error: 'Failed to update device sync timestamp',
      });
      console.warn('Warning: Failed to update device lastSync');
    }

    // סנכרון הסתיים בהצלחה
    result.success = true;
    console.log('✓ Sync completed successfully');
    console.log('Summary:', {
      synced: result.synced,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    // שגיאה כללית — מחזירים תוצאת כישלון
    console.error('Sync failed:', error);
    result.success = false;
    result.errors.push({
      step: 'general',
      error: error.message || 'Sync failed',
    });

    return result;
  }
};

/**
 * getNewWorkoutsPreview — שליפת אימונים חדשים ל-preview בלי לשמור.
 * שימושי לתצוגה מקדימה לפני אישור ידני.
 *
 * @param {number} lookbackDays - מספר ימים לאחור
 * @returns {Promise<Array>} מערך אימונים מובנים
 */
export const getNewWorkoutsPreview = async (lookbackDays = 7) => {
  try {
    const { startDate, endDate } = getDateRangeForDays(lookbackDays);
    const workouts = await getStructuredWorkouts(startDate, endDate);
    return workouts || [];
  } catch (error) {
    console.error('Error getting workouts preview:', error);
    throw error;
  }
};

/**
 * clearOldLogs — ניקוי לוגים ישנים (לא ממומש).
 * ⚠️ פעולה הרסנית — שמורה לשימוש עתידי דרך כלי Admin של ה-Backend.
 */
export const clearOldLogs = async () => {
  console.warn('clearOldLogs not implemented - use backend admin tools');
};

// ייצוא ברירת מחדל — מכיל את הפונקציות הראשיות
export default {
  syncWorkoutsToBackend,
  getNewWorkoutsPreview,
};
