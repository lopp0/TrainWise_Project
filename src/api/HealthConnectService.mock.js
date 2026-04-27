/**
 * HealthConnectService.mock.js
 *
 * מימוש דמה (mock) של HealthConnectService לשימוש ב-Expo Go ובדפדפן,
 * שם המודול הנייטיב react-native-health-connect אינו זמין.
 * כל הפונקציות מחזירות ערכי ברירת מחדל בטוחים ללא קריאה ל-API נייטיב.
 *
 * נכתב כ-CommonJS טהור כדי שניתן יהיה לטעון אותו ב-require() מ-HealthConnectService.js.
 */

// initializeHealthConnect — תמיד מחזיר false (HC לא זמין בסביבה זו)
const initializeHealthConnect = async () => {
  return false;
};

// requestPermissions — מדמה שאין הרשאות
const requestPermissions = async () => {
  return { granted: [], permissions: [] };
};

// checkPermissions — מדמה שאין הרשאות
const checkPermissions = async () => {
  return { granted: [], permissions: [] };
};

// hasAllPermissions — תמיד מחזיר false (אין הרשאות)
const hasAllPermissions = async () => {
  return false;
};

// fetchWorkoutSessions — מדמה שאין אימונים (מתעלם מהפרמטרים)
const fetchWorkoutSessions = async (_startDate, _endDate) => {
  return [];
};

// fetchStepsForSession — מדמה אפס צעדים
const fetchStepsForSession = async (_startTime, _endTime) => {
  return 0;
};

// fetchHeartRateForSession — מדמה אפס פעימות לב
const fetchHeartRateForSession = async (_startTime, _endTime) => {
  return { avgHeartRate: 0, maxHeartRate: 0 };
};

// fetchCaloriesForSession — מדמה אפס קלוריות
const fetchCaloriesForSession = async (_startTime, _endTime) => {
  return 0;
};

// fetchDistanceForSession — מדמה אפס מרחק
const fetchDistanceForSession = async (_startTime, _endTime) => {
  return 0;
};

// getStructuredWorkouts — מדמה שאין אימונים מובנים
const getStructuredWorkouts = async (_startDate, _endDate) => {
  return [];
};

// ייצוא כל הפונקציות — גם כ-named exports וגם כ-default object
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
  // default export לתאימות עם קוד שמשתמש ב-import default
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
