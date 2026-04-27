// שכבת API ראשית — axios instance + פונקציות auth ו-activity logs
import axios from 'axios';

/**
 * axios instance משותף לכל קריאות ה-API ל-backend של TrainWise.
 * אין JWT — מבוסס session עם userId.
 */

// כתובת הבסיס — הטלפון מגיע ל-PC דרך 'adb reverse tcp:5249 tcp:5249'
const BASE_URL = 'http://127.0.0.1:5249';
// timeout של 30 שניות לכל בקשה
const API_TIMEOUT = 30000;

// יצירת axios instance עם הגדרות ברירת מחדל
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// AUTH ENDPOINTS — כניסה והרשמה
// ============================================================================

/**
 * login — כניסה עם אימייל וסיסמה.
 * מחזיר אובייקט User מלא עם userId, fullName וכו'.
 */
export const login = async (email, password) => {
  try {
    // POST לנקודת הקצה של ה-login
    const response = await apiClient.post('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    // הצגת הודעת שגיאה ידידותית
    throw new Error(
      error.response?.data || 'Login failed. Please check your credentials.'
    );
  }
};

/**
 * registerUser — הרשמת משתמש חדש.
 * השרת קובע בעצמו profileImagePath, שדות baseline ו-CreatedAt.
 * @param {Object} payload - CreateUserRequest: fullName, birthYear, gender, height,
 *   weight, activityLevel, deviceType, userName, email, password, experienceLevel,
 *   healthDeclaration, confirmTerms, termConfirmationDate, isCoach.
 * @returns {Promise<Object>} { userID } בהצלחה
 */
export const registerUser = async (payload) => {
  try {
    const response = await apiClient.post('/api/Users', payload);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data || 'Registration failed. Please try again.'
    );
  }
};

// ============================================================================
// ACTIVITY LOG ENDPOINTS — יומן פעילות
// ============================================================================

/**
 * getActivityLogs — שליפת כל לוגי הפעילות של משתמש.
 * מוסיף מידע מפורט על השגיאה כדי לעזור בדיבאג (backend down, adb reverse וכו').
 */
export const getActivityLogs = async (userId) => {
  try {
    const response = await apiClient.get(`/api/ActivityLog/user/${userId}`);
    return response.data;
  } catch (error) {
    // בניית הודעת שגיאה מפורטת — HTTP status + body
    const status = error.response?.status;
    const body = error.response?.data;
    const detail = status
      ? `HTTP ${status}${body ? ` — ${typeof body === 'string' ? body : JSON.stringify(body)}` : ''}`
      : error.message || 'Network error';
    console.warn('[api] getActivityLogs failed:', detail);
    throw new Error(`Failed to fetch activity logs (${detail})`);
  }
};

/**
 * postActivityLog — יצירת רשומת פעילות חדשה.
 * נדרש למלא את כל שדות הסכמה של ActivityLog.
 */
export const postActivityLog = async (activityData) => {
  try {
    const response = await apiClient.post('/api/ActivityLog', activityData);
    return response.data;
  } catch (error) {
    console.error('Error creating activity log:', error);
    throw new Error('Failed to create activity log');
  }
};

/**
 * putActivityLog — עדכון רשומת פעילות קיימת.
 * משמש לאישור אימוני Health Connect (שינוי exertionLevel + isConfirmed).
 */
export const putActivityLog = async (activityData) => {
  try {
    const response = await apiClient.put('/api/ActivityLog', activityData);
    return response.data;
  } catch (error) {
    console.error('Error updating activity log:', error);
    throw new Error('Failed to update activity log');
  }
};

/**
 * deleteActivityLog — מחיקת רשומת פעילות לפי ID.
 */
export const deleteActivityLog = async (activityLogId) => {
  try {
    await apiClient.delete(`/api/ActivityLog/${activityLogId}`);
  } catch (error) {
    console.error('Error deleting activity log:', error);
    throw new Error('Failed to delete activity log');
  }
};

// ============================================================================
// USER DEVICE ENDPOINTS — מכשירי המשתמש
// ============================================================================

/**
 * getUserDevices — שליפת כל המכשירים המקושרים למשתמש.
 */
export const getUserDevices = async (userId) => {
  try {
    const response = await apiClient.get(`/api/users/${userId}/devices`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user devices:', error);
    throw new Error('Failed to fetch user devices');
  }
};

/**
 * postUserDevice — רישום מכשיר חדש למשתמש.
 * @param {Object} deviceData - deviceName, lastSync, permissionsGranted
 */
export const postUserDevice = async (userId, deviceData) => {
  try {
    const response = await apiClient.post(
      `/api/users/${userId}/devices`,
      deviceData
    );
    return response.data;
  } catch (error) {
    console.error('Error creating user device:', error);
    throw new Error('Failed to register device');
  }
};

/**
 * putUserDevice — עדכון פרטי מכשיר (לדוגמה lastSync).
 */
export const putUserDevice = async (userId, deviceId, deviceData) => {
  try {
    const response = await apiClient.put(
      `/api/users/${userId}/devices/${deviceId}`,
      deviceData
    );
    return response.data;
  } catch (error) {
    console.error('Error updating user device:', error);
    throw new Error('Failed to update device');
  }
};

// ============================================================================
// HELPER FUNCTIONS — עזרים
// ============================================================================

/**
 * setBaseURL — שינוי כתובת הבסיס בזמן ריצה.
 * שימושי לסביבות שונות (dev/staging/prod).
 */
export const setBaseURL = (newUrl) => {
  apiClient.defaults.baseURL = newUrl;
};

/**
 * getBaseURL — קריאת כתובת הבסיס הנוכחית.
 */
export const getBaseURL = () => {
  return apiClient.defaults.baseURL;
};

// ה-instance הגולמי — לשימוש ישיר כשצריך headers נוספים או interceptors
export default apiClient;
