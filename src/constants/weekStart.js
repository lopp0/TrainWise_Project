// ניהול הגדרת יום תחילת השבוע — נשמר ב-AsyncStorage ומשמש בגרפים ובדשבורד
import AsyncStorage from '@react-native-async-storage/async-storage';

// המפתח בו נשמרת ההגדרה ב-AsyncStorage
const KEY = 'trainwise.weekStartDay';

// שמות ימי השבוע בקיצור — Sun=0, Mon=1, ... Sat=6
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ברירת מחדל: שבוע מתחיל ביום ראשון (index 0)
export const DEFAULT_WEEK_START = 0;

// משתנה מקומי לשמירת הערך הנוכחי בזיכרון (מהיר יותר מקריאה חוזרת מ-AsyncStorage)
let _cachedWeekStart = DEFAULT_WEEK_START;
// רשימת מאזינים שיקבלו עדכון כשהיום משתנה
const _listeners = new Set();

// טוען את הגדרת יום תחילת השבוע מ-AsyncStorage בעת הפעלת האפליקציה
export const initWeekStart = async () => {
  try {
    // קריאת הערך השמור
    const raw = await AsyncStorage.getItem(KEY);
    // אם אין ערך — משתמשים בברירת מחדל; אחרת ממירים למספר שלם
    const parsed = raw == null ? DEFAULT_WEEK_START : Number.parseInt(raw, 10);
    // וידוא שהערך חוקי (0–6); אם לא — חוזרים לברירת מחדל
    _cachedWeekStart = Number.isFinite(parsed) && parsed >= 0 && parsed <= 6
      ? parsed
      : DEFAULT_WEEK_START;
  } catch {
    // במקרה של שגיאה (AsyncStorage לא זמין) — ברירת מחדל
    _cachedWeekStart = DEFAULT_WEEK_START;
  }
  return _cachedWeekStart;
};

// מחזיר את יום תחילת השבוע הנוכחי מהזיכרון (ללא I/O)
export const getWeekStartDay = () => _cachedWeekStart;

// מעדכן את יום תחילת השבוע, שומר ב-AsyncStorage ומודיע לכל המאזינים
export const setWeekStartDay = async (dayIndex) => {
  // מבטיח שהערך נמצא בטווח 0–6
  const day = Math.max(0, Math.min(6, Number(dayIndex) || 0));
  // עדכון הזיכרון המקומי
  _cachedWeekStart = day;
  try {
    // שמירה קבועה ב-AsyncStorage
    await AsyncStorage.setItem(KEY, String(day));
  } catch {}
  // הודעה לכל המאזינים הרשומים על השינוי
  _listeners.forEach((fn) => fn(day));
  return day;
};

// רישום מאזין שיופעל בכל שינוי יום תחילת שבוע — מחזיר פונקציית ביטול
export const subscribeWeekStart = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

/**
 * מחזיר את תאריך תחילת השבוע (חצות) ביחס לשבוע הנוכחי.
 * offset=0 = השבוע הנוכחי, offset=-1 = שבוע שעבר וכו'.
 * מכבד את הגדרת יום תחילת השבוע של המשתמש.
 */
export const getWeekStartDate = (offset = 0, weekStartDay = _cachedWeekStart) => {
  // תאריך היום
  const today = new Date();
  const d = new Date(today);
  // חישוב ההפרש בימים מהיום ועד ליום תחילת השבוע
  const diff = (today.getDay() - weekStartDay + 7) % 7;
  // הזזה לתאריך תחילת השבוע + offset שבועות
  d.setDate(today.getDate() - diff + offset * 7);
  // איפוס לחצות כדי להשוות תאריכים ללא שעה
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * מחזיר מערך של 7 תוויות ימים בסדר הנכון לפי יום תחילת השבוע.
 * לדוגמה: אם השבוע מתחיל בשני → ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
 */
export const getWeekDayLabels = (weekStartDay = _cachedWeekStart) =>
  Array.from({ length: 7 }, (_, i) => DAY_NAMES[(weekStartDay + i) % 7]);
