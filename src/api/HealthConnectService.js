/**
 * HealthConnectService — Wrapper ל-API של Health Connect ב-Android.
 * מטפל בהרשאות, שליפת נתונים והמרת אימונים לפורמט הנדרש.
 *
 * מיפוי סוגי תרגיל ב-Health Connect לסוגי פעילות ב-Backend:
 * - 56 -> RUNNING (activityTypeID: 1)
 * - 79 -> WALKING (activityTypeID: 2)
 * - 8  -> BIKING  (activityTypeID: 3)
 * - 80 -> WEIGHTLIFTING (activityTypeID: 4)
 * - אחר -> Default (activityTypeID: 5)
 *
 * איך ה-guard עובד:
 * NativeHealthConnect.js של react-native-health-connect קורא ל-
 * TurboModuleRegistry.getEnforcing('HealthConnect') בעת טעינת המודול.
 * ב-Expo Go המודול לא רשום, ולכן הקריאה זורקת JS Error רגיל.
 * אנחנו תופסים שגיאה זו ומחזירים את ה-mock שקוף — האפליקציה
 * עובדת ב-Expo Go ללא קריסה. בבילד Android אמיתי ה-require מצליח.
 *
 * למה CommonJS (require/module.exports) ולא ES module imports:
 * import נרשם על-ידי Babel/Metro לפני הרצת כל קוד. זה מונע guard
 * בזמן ריצה. שימוש ב-require() שומר את הטעינה עצמאית ותפיסה
 * של שגיאות.
 */

// --------------------------------------------------------------------------
// ניסיון לטעון את ה-Native Module.
// TurboModuleRegistry.getEnforcing זורק JS Error ב-Expo Go.
// --------------------------------------------------------------------------
let _hc = null;
try {
  // ניסיון לטעון — יצליח בבילד Android, ייכשל ב-Expo Go
  _hc = require('react-native-health-connect');
} catch (_e) {
  // המודול הנייטיבי אינו זמין (Expo Go, web, וכדומה)
  // _hc נשאר null וניפול ל-mock
}

if (_hc === null) {
  // ── Expo Go / web / כל סביבה ללא המודול הנייטיבי ──────────────
  // ייצוא ה-mock שמחזיר ערכים ריקים/false/0 לכל פונקציה
  module.exports = require('./HealthConnectService.mock.js');
} else {
  // ── בילד נייטיבי אמיתי ────────────────────────────────────────
  const {
    initialize,            // אתחול SDK של Health Connect
    requestPermission,     // בקשת הרשאות מהמשתמש
    readRecords,           // קריאת רשומות מ-Health Connect
    getSdkStatus,          // בדיקת זמינות ה-SDK
    getGrantedPermissions, // שליפת הרשאות שניתנו
    SdkAvailabilityStatus, // קבועי סטטוס זמינות ה-SDK
  } = _hc;

  // מיפוי מ-exerciseType של HC ל-activityTypeID של ה-Backend
  const EXERCISE_TYPE_MAPPING = {
    56: 1, // RUNNING
    79: 2, // WALKING
    8: 3,  // BIKING
    80: 4, // WEIGHTLIFTING / STRENGTH
  };

  // activityTypeID ברירת מחדל לסוגים לא מוכרים
  const DEFAULT_ACTIVITY_TYPE_ID = 5;

  // הרשאות HC הנדרשות (react-native-health-connect v3+)
  // שמות recordType תלויי-רישיות ועוקבים אחר שמות הספרייה.
  // ActiveCaloriesBurned = קלוריות אימון בלבד (ללא BMR).
  // TotalCaloriesBurned = כולל BMR — יגדיל קלוריות פי 3-7 בסשנים קצרים,
  // לכן נשמור גם אותו כ-fallback: נעדיף Active, נסוג ל-Total רק כשActive חסר.
  const REQUIRED_PERMISSIONS = [
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'read', recordType: 'HeartRate' },
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    { accessType: 'read', recordType: 'TotalCaloriesBurned' },
    { accessType: 'read', recordType: 'Steps' },
  ];

  // ערך הסטטוס "SDK זמין" — ברירת מחדל 3 אם הקבוע לא קיים בגרסה ישנה
  const SDK_AVAILABLE =
    (SdkAvailabilityStatus && SdkAvailabilityStatus.SDK_AVAILABLE) ?? 3;

  // בדיקה ואתחול ה-SDK — מחזיר true אם מוכן לשימוש
  const initializeHealthConnect = async () => {
    try {
      // בדיקת סטטוס ה-SDK מול הקבוע SDK_AVAILABLE
      const status = await getSdkStatus();
      console.log('[HC] getSdkStatus ->', status, '(expected', SDK_AVAILABLE, ')');
      if (status !== SDK_AVAILABLE) {
        console.warn('[HC] SDK not available on this device');
        return false;
      }
      // אתחול המודול — חייב לקדום כל קריאה אחרת
      const initialized = await initialize();
      console.log('[HC] initialize ->', initialized);
      return initialized === true;
    } catch (error) {
      console.error('[HC] initializeHealthConnect error:', error);
      return false;
    }
  };

  // בקשת הרשאות מהמשתמש — פותח את מסך ההרשאות של Health Connect
  const requestPermissions = async () => {
    try {
      console.log('[HC] requestPermission with:', REQUIRED_PERMISSIONS);
      // requestPermission מחזיר מערך ההרשאות שאושרו
      const grantedPermissions = await requestPermission(REQUIRED_PERMISSIONS);
      console.log('[HC] grantedPermissions ->', grantedPermissions);
      return { granted: grantedPermissions || [], permissions: REQUIRED_PERMISSIONS };
    } catch (error) {
      console.error('[HC] requestPermission threw:', error);
      throw error;
    }
  };

  // בדיקת הרשאות קיימות ללא פתיחת dialog
  const checkPermissions = async () => {
    try {
      // HC מחייב initialize() לפני כל קריאה. אם caller בדק הרשאות
      // לפני requestPermissions(), הקריאה זורקת ClientNotInitialized.
      // לכן: אתחול לאזי כאן.
      await initializeHealthConnect();
      const grantedPermissions = await getGrantedPermissions();
      return { granted: grantedPermissions || [], permissions: REQUIRED_PERMISSIONS };
    } catch (error) {
      console.error('[HC] getGrantedPermissions threw:', error);
      // שגיאה = לא נתנו הרשאות
      return { granted: [], permissions: REQUIRED_PERMISSIONS };
    }
  };

  // בדיקה אם כל ההרשאות הנדרשות ניתנו (בדיקה מדויקת לפי recordType + accessType)
  const hasAllPermissions = async () => {
    try {
      const { granted } = await checkPermissions();
      // every: כל הרשאה נדרשת חייבת להיות ברשימת ה-granted
      return REQUIRED_PERMISSIONS.every((req) =>
        granted.some(
          (g) => g.recordType === req.recordType && g.accessType === req.accessType
        )
      );
    } catch (error) {
      console.error('[HC] hasAllPermissions error:', error);
      return false;
    }
  };

  /**
   * שליפת סשני תרגיל מ-Health Connect לטווח תאריכים.
   * @param {Date} startDate - תאריך התחלה
   * @param {Date} endDate - תאריך סיום
   * @returns {Promise<Array>} מערך סשנים
   */
  const fetchWorkoutSessions = async (startDate, endDate) => {
    try {
      const result = await readRecords('ExerciseSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });
      // גרסה 3.x מחזירה { records, pageToken }; גרסאות ישנות מחזירות מערך ישיר
      const sessions = Array.isArray(result) ? result : result?.records || [];
      console.log('[HC] Fetched exercise sessions count:', sessions.length);
      return sessions;
    } catch (error) {
      console.log('[HC] fetchWorkoutSessions failed:', error?.message || error);
      throw new Error('Failed to fetch workout sessions');
    }
  };

  /**
   * שליפת ספירת צעדים לסשן ספציפי.
   * @param {Date|string} startTime - זמן התחלה
   * @param {Date|string} endTime - זמן סיום
   * @returns {Promise<number>} סה"כ צעדים
   */
  const fetchStepsForSession = async (startTime, endTime) => {
    try {
      // המרה ל-ISO string אם הערך הוא Date
      const startISO = typeof startTime === 'string' ? startTime : startTime.toISOString();
      const endISO = typeof endTime === 'string' ? endTime : endTime.toISOString();
      const result = await readRecords('Steps', {
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      const steps = Array.isArray(result) ? result : result?.records || [];
      // סיכום כל הרשומות — כל רשומה יכולה לייצג טווח זמן שונה
      return steps.reduce((sum, record) => sum + (record.count || 0), 0);
    } catch (error) {
      console.error('Error fetching steps:', error);
      return 0;
    }
  };

  /**
   * שליפת נתוני דופק לסשן ספציפי.
   * @param {Date|string} startTime
   * @param {Date|string} endTime
   * @returns {Promise<{ avgHeartRate: number, maxHeartRate: number }>}
   */
  const fetchHeartRateForSession = async (startTime, endTime) => {
    try {
      const startISO = typeof startTime === 'string' ? startTime : startTime.toISOString();
      const endISO = typeof endTime === 'string' ? endTime : endTime.toISOString();
      const hrResult = await readRecords('HeartRate', {
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      const heartRateData = Array.isArray(hrResult) ? hrResult : hrResult?.records || [];
      // אם אין נתוני דופק — מחזיר 0
      if (!heartRateData || heartRateData.length === 0) {
        return { avgHeartRate: 0, maxHeartRate: 0 };
      }
      // שטוח את כל ה-samples מכל הרשומות ושולף BPM > 0
      const bpmValues = heartRateData
        .flatMap((record) => record.samples || [])
        .map((sample) => sample.beatsPerMinute || 0)
        .filter((bpm) => bpm > 0);
      if (bpmValues.length === 0) {
        return { avgHeartRate: 0, maxHeartRate: 0 };
      }
      // ממוצע עגול ומקסימום
      const avgHeartRate = Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length);
      const maxHeartRate = Math.max(...bpmValues);
      return { avgHeartRate, maxHeartRate };
    } catch (error) {
      console.error('Error fetching heart rate:', error);
      return { avgHeartRate: 0, maxHeartRate: 0 };
    }
  };

  /**
   * שליפת קלוריות שנשרפו בסשן (קלוריות אימון בלבד, ללא BMR).
   * מעדיף ActiveCaloriesBurned; נסוג ל-TotalCaloriesBurned רק אם חסר,
   * תוך הפחתת BMR מוערך כדי למנוע ניפוח הנתון.
   * @param {Date|string} startTime
   * @param {Date|string} endTime
   * @returns {Promise<number>} קלוריות שנשרפו
   */
  const fetchCaloriesForSession = async (startTime, endTime) => {
    const startISO = typeof startTime === 'string' ? startTime : startTime.toISOString();
    const endISO = typeof endTime === 'string' ? endTime : endTime.toISOString();
    // עזר: סיכום קלוריות מרשימת רשומות — תומך בשני פורמטי energy
    const sumKcal = (records) =>
      records.reduce((sum, r) => {
        const kcal =
          r.energy?.inKilocalories ??
          (r.energy?.inCalories ? r.energy.inCalories / 1000 : 0);
        return sum + kcal;
      }, 0);

    try {
      // ניסיון ראשון: ActiveCaloriesBurned (קלוריות אימון נטו)
      const activeResult = await readRecords('ActiveCaloriesBurned', {
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      const activeData = Array.isArray(activeResult) ? activeResult : activeResult?.records || [];
      if (activeData.length > 0) {
        // יש נתוני Active — מחזיר אותם ישירות
        return sumKcal(activeData);
      }
    } catch (error) {
      console.log('[HC] ActiveCaloriesBurned unavailable, falling back to Total:', error?.message || error);
    }

    try {
      // Fallback: TotalCaloriesBurned (כולל BMR)
      const totalResult = await readRecords('TotalCaloriesBurned', {
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      const totalData = Array.isArray(totalResult) ? totalResult : totalResult?.records || [];
      const totalKcal = sumKcal(totalData);
      // הפחתת BMR מוערך: ~70 kcal/שעה (ממוצע למבוגר נח)
      // מונע קריאות של 1500+ kcal בסשנים קצרים כשרק Total זמין
      const minutes = (new Date(endISO) - new Date(startISO)) / 60000;
      const bmrKcal = (minutes / 60) * 70;
      return Math.max(0, totalKcal - bmrKcal);  // לא פחות מ-0
    } catch (error) {
      console.error('Error fetching calories:', error);
      return 0;
    }
  };

  /**
   * שליפת מרחק שנסע בסשן (בקילומטרים).
   * @param {Date|string} startTime
   * @param {Date|string} endTime
   * @returns {Promise<number>} מרחק ב-km
   */
  const fetchDistanceForSession = async (startTime, endTime) => {
    try {
      const startISO = typeof startTime === 'string' ? startTime : startTime.toISOString();
      const endISO = typeof endTime === 'string' ? endTime : endTime.toISOString();
      const distResult = await readRecords('Distance', {
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      const distanceData = Array.isArray(distResult) ? distResult : distResult?.records || [];
      // סיכום מטרים + המרה לק"מ
      const totalMeters = distanceData.reduce(
        (sum, record) => sum + (record.distance?.inMeters || 0),
        0
      );
      return totalMeters / 1000;
    } catch (error) {
      console.error('Error fetching distance:', error);
      return 0;
    }
  };

  // המרה מ-exerciseType של HC ל-activityTypeID: מחפש במפה, ברירת מחדל = 5
  const mapExerciseType = (exerciseType) =>
    EXERCISE_TYPE_MAPPING[exerciseType] || DEFAULT_ACTIVITY_TYPE_ID;

  // חישוב משך הסשן בדקות שלמות
  const calculateDuration = (startTime, endTime) =>
    Math.round((new Date(endTime) - new Date(startTime)) / (1000 * 60));

  /**
   * getStructuredWorkouts — הפונקציה הראשית לשליפה.
   * מאחדת את כל מקורות הנתונים (ExerciseSession, HeartRate, Calories, Distance).
   * מאתחלת HC ובודקת הרשאות בעצמה — callers לא צריכים לדאוג לכך.
   * מחזירה [] שקט כשHC לא זמין או הרשאות חסרות — למניעת קריסה ב-UI.
   *
   * @param {Date} startDate - תאריך התחלה
   * @param {Date} endDate - תאריך סיום
   * @returns {Promise<Array>} מערך אימונים מובנים
   */
  const getStructuredWorkouts = async (startDate, endDate) => {
    try {
      // אתחול — מחזיר false אם HC לא זמין
      const ready = await initializeHealthConnect();
      if (!ready) {
        console.log('[HC] SDK not ready, returning empty workout list');
        return [];
      }
      // בדיקת כל ההרשאות הנדרשות
      const granted = await hasAllPermissions();
      if (!granted) {
        console.log('[HC] Required permissions not granted, returning empty workout list');
        return [];
      }
      console.log(`Fetching structured workouts from ${startDate} to ${endDate}`);
      // שליפת סשנים בסיסיים
      const sessions = await fetchWorkoutSessions(startDate, endDate);
      if (!sessions || sessions.length === 0) {
        console.log('No workout sessions found');
        return [];
      }
      // עיבוד מקבילי של כל הסשנים — Promise.all מביא ביצועים
      const structuredWorkouts = await Promise.all(
        sessions.map(async (session) => {
          try {
            const startTime = session.startTime || new Date(0);
            const endTime = session.endTime || new Date();
            // שליפה מקבילית של דופק, קלוריות ומרחק לאותו סשן
            const [heartRateData, caloriesData, distanceData] = await Promise.all([
              fetchHeartRateForSession(startTime, endTime),
              fetchCaloriesForSession(startTime, endTime),
              fetchDistanceForSession(startTime, endTime),
            ]);
            // בניית אובייקט הסשן המובנה לפי הסכמה של ה-Backend
            return {
              userID: null,                                           // יוגדר בעת הסנכרון
              activityTypeID: mapExerciseType(session.exerciseType), // המרת סוג תרגיל
              startTime: new Date(startTime).toISOString(),
              endTime: new Date(endTime).toISOString(),
              distanceKM: Math.round(distanceData * 100) / 100,      // עיגול ל-2 ספרות
              avgHeartRate: heartRateData.avgHeartRate,
              maxHeartRate: heartRateData.maxHeartRate,
              caloriesBurned: Math.round(caloriesData * 10) / 10,    // עיגול ל-1 ספרה
              sourceDevice: 'Health Connect',
              exertionLevel: 5,              // ברירת מחדל — המשתמש יאשר ידנית
              duration: calculateDuration(startTime, endTime),
              isConfirmed: false,            // HC workouts מחכים לאישור
            };
          } catch (error) {
            // שגיאה בסשן בודד לא עוצרת את שאר העיבוד — מחזיר null
            console.error('Error processing session', session.startTime, 'Error:', error);
            return null;
          }
        })
      );
      // סינון null (סשנים שנכשלו) מהתוצאה
      const validWorkouts = structuredWorkouts.filter((w) => w !== null);
      console.log(`Processed ${validWorkouts.length} valid workouts`);
      return validWorkouts;
    } catch (error) {
      // שגיאה כללית — מחזיר [] ולא זורק, כדי שה-UI לא יקרוס
      console.log('[HC] getStructuredWorkouts failed, returning empty list:', error?.message || error);
      return [];
    }
  };

  // ייצוא CommonJS — מכיל את כל הפונקציות הציבוריות
  module.exports = {
    initializeHealthConnect,
    requestPermissions,
    checkPermissions,
    hasAllPermissions,
    fetchWorkoutSessions,
    fetchStepsForSession,
    fetchHeartRateForSession,
    fetchCaloriesForSession,
    fetchDistanceForSession,
    getStructuredWorkouts,
    // ייצוא ברירת מחדל מקונן — תמיכה ב-destructuring של קוד ישן
    default: {
      initializeHealthConnect,
      requestPermissions,
      checkPermissions,
      hasAllPermissions,
      fetchWorkoutSessions,
      fetchStepsForSession,
      fetchHeartRateForSession,
      fetchCaloriesForSession,
      fetchDistanceForSession,
      getStructuredWorkouts,
    },
  };
}
