// Context לסנכרון אוטומטי עם Health Connect — מריץ סנכרון ברקע ומנהל badge
import React, {
  createContext,   // יצירת Context
  useCallback,     // מונע יצירת פונקציות מחדש בכל render
  useContext,      // גישה ל-Context
  useEffect,       // תופעות לוואי
  useRef,          // ערך שנשמר בין renders ללא re-render
  useState,        // state מקומי
} from 'react';
// AppState מאפשר לזהות מתי האפליקציה חוזרת לפורגראונד
import { AppState } from 'react-native';
// ייבוא AuthContext לקבלת userId
import { useAuth } from './AuthContext';
// useSyncWorkouts מכיל את לוגיקת הסנכרון עם HC
import useSyncWorkouts from './useSyncWorkouts';
// getActivityLogs לספירת אימונים לא מאושרים (badge)
import { getActivityLogs } from './api';

// יצירת ה-Context
const HealthSyncContext = createContext(null);

// מינימום זמן בין סנכרונים אוטומטיים — 30 שניות
const AUTOSYNC_THROTTLE_MS = 30_000;

// HealthSyncProvider — עוטף את חלק האפליקציה שדורש גישה לסנכרון HC
export const HealthSyncProvider = ({ children }) => {
  // קבלת userId מה-AuthContext
  const { userId } = useAuth();
  // פרישת כלי הסנכרון מה-hook
  const {
    triggerSync,          // מפעיל את הסנכרון בפועל
    permissionsGranted,   // האם הרשאות HC ניתנו
    checkHCPermissions,   // בדיקת הרשאות קיימות
    requestHCPermissions, // בקשת הרשאות מהמשתמש
    isSyncing,            // האם סנכרון פעיל כרגע
    error,                // הודעת שגיאה אחרונה
  } = useSyncWorkouts();

  // מספר האימונים שטרם אושרו — מוצג כ-badge על אייקון ה-Health tab
  const [unconfirmedCount, setUnconfirmedCount] = useState(0);
  // timestamp הסנכרון האחרון — לthrottle (שימוש ב-ref כדי לא לגרום re-render)
  const lastAutoSyncRef = useRef(0);

  // עדכון מספר האימונים הלא מאושרים מהשרת
  const refreshUnconfirmedCount = useCallback(async () => {
    // אם אין משתמש — אפס את הספירה
    if (!userId) {
      setUnconfirmedCount(0);
      return;
    }
    try {
      // שליפת כל הלוגים של המשתמש
      const logs = await getActivityLogs(userId);
      // ספירת אלה שה-isConfirmed שלהם לא true
      const count = (logs || []).filter((w) => !w.isConfirmed).length;
      setUnconfirmedCount(count);
    } catch (e) {
      console.warn('[HealthSync] count refresh failed:', e.message);
    }
  }, [userId]);

  // runAutoSync — מריץ סנכרון אוטומטי עם throttle (לא יותר מאחת ל-30 שניות)
  const runAutoSync = useCallback(async () => {
    // אם אין משתמש — לא מסנכרנים
    if (!userId) return;
    const now = Date.now();
    // האם עבר מספיק זמן מהסנכרון האחרון?
    const stale = now - lastAutoSyncRef.current >= AUTOSYNC_THROTTLE_MS;
    // עדכון timestamp הסנכרון
    lastAutoSyncRef.current = now;

    try {
      // בדיקת הרשאות HC
      const granted = await checkHCPermissions();
      // מסנכרן רק אם יש הרשאות וה-throttle הסתיים
      if (granted && stale) {
        await triggerSync(7); // 7 ימים אחורה
      }
    } catch (e) {
      console.warn('[HealthSync] auto-sync failed:', e.message);
    } finally {
      // בכל מקרה — עדכן את ספירת הלא-מאושרים
      await refreshUnconfirmedCount();
    }
  }, [userId, checkHCPermissions, triggerSync, refreshUnconfirmedCount]);

  // הפעלת סנכרון ראשוני כשהמשתמש מתחבר
  useEffect(() => {
    if (userId) {
      // איפוס ה-throttle כדי לכפות סנכרון ראשוני
      lastAutoSyncRef.current = 0;
      runAutoSync();
    } else {
      // משתמש התנתק — אפס את הספירה
      setUnconfirmedCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // האזנה לחזרת האפליקציה לפורגראונד — מריצה סנכרון נוסף
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      // 'active' = האפליקציה חזרה לפורגראונד
      if (state === 'active' && userId) runAutoSync();
    });
    // ניקוי ה-listener בעת פירוק הקומפוננט
    return () => sub.remove();
  }, [userId, runAutoSync]);

  // ספקת הערכים לכל הצאצאים
  return (
    <HealthSyncContext.Provider
      value={{
        permissionsGranted,       // האם HC מחובר
        unconfirmedCount,          // ספירת אימונים לא מאושרים (badge)
        isSyncing,                 // האם סנכרון בתהליך
        lastSyncError: error,      // שגיאת הסנכרון האחרונה
        runAutoSync,               // הפעלת סנכרון ידני
        refreshUnconfirmedCount,   // עדכון ספירת ה-badge
        requestHCPermissions,      // בקשת הרשאות HC
      }}
    >
      {children}
    </HealthSyncContext.Provider>
  );
};

// Hook לגישה ל-HealthSyncContext — זורק שגיאה אם לא בתוך HealthSyncProvider
export const useHealthSync = () => {
  const ctx = useContext(HealthSyncContext);
  if (!ctx) {
    throw new Error('useHealthSync must be used inside HealthSyncProvider');
  }
  return ctx;
};
