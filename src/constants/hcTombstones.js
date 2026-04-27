// ניהול "מצבות" לאימוני Health Connect — מונע ייבוא חוזר של אימונים שנמחקו
import AsyncStorage from '@react-native-async-storage/async-storage';

// המפתח בו נשמרת רשימת המצבות ב-AsyncStorage
const KEY = 'trainwise.hcDeletedKeys';

// Set המכיל את כל מפתחות האימונים שנמחקו — Set נותן חיפוש מהיר O(1)
let _cache = new Set();
// דגל שמציין האם הרשימה כבר נטענה (כדי לא לטעון שוב ושוב)
let _loaded = false;

/**
 * יוצר מפתח זיהוי אחיד לאימון על בסיס ה-startTime שלו.
 * השרת מוריד את ה-Z הסופי, והשניות יכולות להשתנות מעט בין HC לשורה השמורה,
 * לכן אנו משווים ברמת דיוק של דקה (16 תווים ראשונים ללא Z).
 */
export const tombstoneKeyFor = (workout) => {
  // קריאת startTime — תומך גם בשדה קטן וגם בשדה עם אות ראשונה גדולה
  const t = workout?.startTime || workout?.StartTime || '';
  // הסרת ה-Z הסופי ולקיחת 16 תווים (YYYY-MM-DDTHH:MM)
  return String(t).replace(/Z$/, '').slice(0, 16);
};

// שמירת הרשימה הנוכחית ל-AsyncStorage (פנימי)
const persist = async () => {
  try {
    // המרת ה-Set למערך ואז ל-JSON לפני השמירה
    await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(_cache)));
  } catch {}
};

// טוען את רשימת המצבות מ-AsyncStorage — נקרא פעם אחת בעת הפעלת האפליקציה
export const loadHcTombstones = async () => {
  // אם כבר נטען — מחזיר את הקאש הקיים
  if (_loaded) return _cache;
  try {
    // קריאת הנתונים השמורים
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      // פיענוח ה-JSON
      const arr = JSON.parse(raw);
      // וידוא שהערך הוא מערך לפני יצירת Set
      if (Array.isArray(arr)) _cache = new Set(arr);
    }
  } catch {}
  // סימון שהטעינה הושלמה
  _loaded = true;
  return _cache;
};

// בדיקה האם אימון נמצא ברשימת המצבות (כלומר — נמחק בעבר)
export const isTombstoned = (workout) => {
  // יצירת המפתח עבור האימון
  const key = tombstoneKeyFor(workout);
  // מחרוזת ריקה = אין startTime תקין = לא tombstoned
  return key !== '' && _cache.has(key);
};

// הוספת אימון לרשימת המצבות ושמירה קבועה
export const tombstoneWorkout = async (workout) => {
  // יצירת המפתח
  const key = tombstoneKeyFor(workout);
  // אם אין מפתח תקין — לא עושים כלום
  if (!key) return;
  // הוספה ל-Set הזיכרוני
  _cache.add(key);
  // שמירה ל-AsyncStorage
  await persist();
};

// מחיקת כל רשימת המצבות (משמש לבדיקות או איפוס)
export const clearHcTombstones = async () => {
  // איפוס ה-Set בזיכרון
  _cache = new Set();
  try {
    // מחיקה מ-AsyncStorage
    await AsyncStorage.removeItem(KEY);
  } catch {}
};
