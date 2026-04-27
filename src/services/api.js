// שכבת API של השירותים — axios instance ופונקציות לכל ה-endpoints
import axios from 'axios';

// כתובת הבסיס של השרת.
// הטלפון מתחבר ל-PC דרך USB עם 'adb reverse tcp:5249 tcp:5249'.
// הטלפון מתייחס ל-127.0.0.1:5249 כאל עצמו; adb מפנה זאת ל-PC.
// אמין יותר מ-WiFi כי עובד דרך כבל USB. לחיבור אלחוטי — שנה ל-IP של ה-PC.
const API_BASE_URL = 'http://127.0.0.1:5249/api';

// יצירת axios instance עם הגדרות ברירת מחדל
const api = axios.create({
  baseURL: API_BASE_URL,   // כתובת בסיס לכל הבקשות
  timeout: 15000,          // timeout של 15 שניות
  headers: {
    'Content-Type': 'application/json',  // כל הבקשות ב-JSON
  },
});

// ==================== USERS — משתמשים ====================

// שליפת משתמש לפי ID
export const getUserById = (userId) =>
  api.get(`/users/${userId}`);

// עדכון פרטי משתמש
export const updateUser = (userId, data) =>
  api.put(`/users/${userId}`, data);

// עדכון תמונת פרופיל
export const updateProfileImage = (userId, imagePath) =>
  api.put(`/users/${userId}/profile-image`, { profileImagePath: imagePath });

// ==================== ACTIVITY TYPES — סוגי פעילות ====================

// שליפת כל סוגי הפעילות (ריצה, הליכה, אופניים וכו')
export const getAllActivityTypes = () =>
  api.get('/activitytype');

// ==================== ACTIVITY LOGS — יומן פעילות ====================

// יצירת רשומת פעילות חדשה
export const createActivityLog = (data) =>
  api.post('/activitylog', data);

// שליפת כל הלוגים של משתמש
export const getActivityLogsByUser = (userId) =>
  api.get(`/activitylog/user/${userId}`);

// מחיקת לוג פעילות לפי ID
export const deleteActivityLog = (activityId) =>
  api.delete(`/activitylog/${activityId}`);

// ==================== DAILY LOAD — עומס יומי ====================

// שליפת העומס היומי של משתמש
export const getDailyLoadByUser = (userId) =>
  api.get(`/dailyload/user/${userId}`);

// הפעלת חישוב מחדש של העומס היומי לתאריך מסוים
// date ברירת מחדל — היום
export const calculateDailyLoad = (userId, date = new Date()) =>
  api.post(`/dailyload/user/${userId}/calculate`, {
    // וידוא שהתאריך מועבר כ-ISO string
    date: date instanceof Date ? date.toISOString() : date,
  });

// ==================== RECOMMENDATIONS — המלצות ====================

// שליפת המלצות אוטומטיות למשתמש
export const getRecommendationsByUser = (userId) =>
  api.get(`/recommendation/user/${userId}`);

// שליפת המלצות מאמן למשתמש
export const getCoachRecommendationsByUser = (userId) =>
  api.get(`/coachrecommendations/user/${userId}`);

// ==================== INJURIES — פציעות ====================

// שליפת כל סוגי הפציעות
export const getAllInjuryTypes = () =>
  api.get('/injurytypes');

// יצירת דוח פציעה חדש
export const createInjuryReport = (data) =>
  api.post('/injuryreport', data);

// שליפת כל הפציעות של משתמש
export const getInjuriesByUser = (userId) =>
  api.get(`/injuryreport/user/${userId}`);

// שליפת הפציעות הפעילות בלבד של משתמש
export const getActiveInjuriesByUser = (userId) =>
  api.get(`/injuryreport/user/${userId}/active`);

// סימון פציעה כמחלימה
export const markInjuryRecovered = (injuryId) =>
  api.put(`/injuryreport/${injuryId}/recover`);

// ==================== COACH — מאמנים ====================

// שליפת פרטי מאמן לפי ID
export const getCoachById = (coachId) =>
  api.get(`/coach/${coachId}`);

// שליפת רשימת המתאמנים של מאמן
export const getTraineesByCoach = (coachId) =>
  api.get(`/coach/${coachId}/trainees`);

// ==================== GOALS & PREFERENCES — מטרות והעדפות ====================

// שליפת כל מטרות האימון הזמינות
export const getAllTrainingGoals = () =>
  api.get('/traininggoals');

// הוספת מטרה למשתמש
export const addUserTrainingGoal = (userId, goalId) =>
  api.post('/usertraininggoals', { userId, goalId });

// הסרת מטרה ממשתמש
export const removeUserTrainingGoal = (userId, goalId) =>
  api.delete(`/usertraininggoals/${userId}/${goalId}`);

// הוספת העדפת פעילות למשתמש
export const addUserActivityPreference = (userId, activityTypeId) =>
  api.post('/useractivitypreferences', { userId, activityTypeId });

// הסרת העדפת פעילות ממשתמש
export const removeUserActivityPreference = (userId, activityTypeId) =>
  api.delete(`/useractivitypreferences/${userId}/${activityTypeId}`);

// ==================== DEVICES — מכשירים ====================

// שליפת כל המכשירים של משתמש
export const getUserDevices = (userId) =>
  api.get(`/userdevice/user/${userId}`);

// רישום מכשיר חדש
export const registerDevice = (data) =>
  api.post('/userdevice', data);

// ה-instance הגולמי — לשימוש ב-endpoints שלא מכוסים בפונקציות למעלה
export default api;
