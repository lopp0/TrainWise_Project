// ניהול תמת האפליקציה (כהה/בהיר) עם שמירה קבועה ב-AsyncStorage
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
// AsyncStorage לשמירת בחירת התמה בין הפעלות
import AsyncStorage from '@react-native-async-storage/async-storage';
// applyTheme מחיל את הפלטה החדשה; getActiveTheme מחזיר את התמה הנוכחית
import { applyTheme, getActiveTheme } from './colors';

// המפתח לשמירת התמה ב-AsyncStorage
const STORAGE_KEY = 'trainwise.theme';

// יצירת ה-Context עם ערכי ברירת מחדל — theme='dark', setTheme ריק
const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
});

// ThemeProvider — עוטף את כל האפליקציה ומספק גישה לתמה
export const ThemeProvider = ({ children }) => {
  // שמירת שם התמה הפעילה כ-state — מאפשרת re-render בשינוי
  const [theme, setThemeState] = useState(getActiveTheme());

  // טוען את התמה השמורה מ-AsyncStorage בעת עלייה ראשונה
  useEffect(() => {
    (async () => {
      try {
        // קריאת הערך השמור
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        // רק ערכים חוקיים ('light' / 'dark') יתקבלו
        if (saved === 'light' || saved === 'dark') {
          // מחיל את הפלטה על Colors singleton
          applyTheme(saved);
          // עדכון ה-state לטריגור re-render
          setThemeState(saved);
        }
      } catch {}
    })();
  }, []);

  // פונקציית שינוי תמה — מאובטחת ומשמרת ב-AsyncStorage
  const setTheme = useCallback(async (next) => {
    // וידוא שהערך חוקי — כל ערך שאינו 'light' הופך ל-'dark'
    const safe = next === 'light' ? 'light' : 'dark';
    // עדכון Colors singleton
    applyTheme(safe);
    // עדכון ה-state
    setThemeState(safe);
    try {
      // שמירה קבועה ב-AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, safe);
    } catch {}
  }, []);

  // שינוי ה-key על ה-Fragment גורם ל-React לפרוק ולהרכיב מחדש את כל העץ.
  // זה מבטיח שמסכים שקראו את Colors בזמן render יקבלו את הפלטה החדשה,
  // גם אם אינם מחוברים ישירות ל-Context. עלות: re-mount מלא בכל החלפת תמה
  // — מקובל כי זה מתרחש רק בפעולת משתמש יזומה.
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/* ה-key משנה את ה-Fragment ומאלץ re-mount מלא של כל הצאצאים */}
      <React.Fragment key={theme}>{children}</React.Fragment>
    </ThemeContext.Provider>
  );
};

// Hook נוח לגישה ל-ThemeContext מכל קומפוננט
export const useTheme = () => useContext(ThemeContext);
