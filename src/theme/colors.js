// מנהל הצבעים הגלובלי של האפליקציה — singleton שניתן לשנות בזמן ריצה
import { darkPalette, lightPalette, PALETTES } from './palettes';

/**
 * `Colors` מיוצא כ-singleton ניתן-לשינוי כדי שמסכים שכבר ייבאו
 * `import { Colors } from '../theme/colors'` ימשיכו לעבוד ללא רפקטור.
 * applyTheme() משנה את האובייקט במקומו; ThemeProvider כופה re-render
 * מלא על כל העץ כדי שהמסכים יקבלו את הערכים החדשים.
 */
// אתחול ה-Colors עם פלטת ברירת המחדל (כהה)
export const Colors = { ...darkPalette };

// שמירת שם התמה הפעילה כרגע
let _activeTheme = 'dark';
// מאזינים שיקבלו הודעה כשהתמה משתנה
const _listeners = new Set();

// מחזיר את שם התמה הפעילה ('dark' / 'light')
export const getActiveTheme = () => _activeTheme;

// מחיל פלטת צבעים חדשה על ה-Colors singleton
export const applyTheme = (themeName) => {
  // מצא את הפלטה המתאימה; אם שם לא מוכר — חוזר לכהה
  const palette = PALETTES[themeName] || darkPalette;
  // מחיקת כל המפתחות הקיימים כדי לנקות את האובייקט
  Object.keys(Colors).forEach((k) => delete Colors[k]);
  // העתקת הצבעים החדשים לאותו אובייקט (אותה הרפרנס בזיכרון)
  Object.assign(Colors, palette);
  // עדכון שם התמה הפעילה
  _activeTheme = palette === lightPalette ? 'light' : 'dark';
  // הודעה לכל המאזינים
  _listeners.forEach((fn) => fn(_activeTheme));
};

// מאפשר לרכיבים להירשם לשינויי תמה — מחזיר פונקציית ביטול הרישום
export const subscribeTheme = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

// קבועי גופן — גדלים ומשקלים שבים בכל האפליקציה
export const Fonts = {
  titleSize: 28,    // גודל כותרות ראשיות
  subtitleSize: 18, // גודל כותרות משניות
  bodySize: 15,     // גודל טקסט גוף
  captionSize: 12,  // גודל כיתוב קטן
  bold: '700',      // משקל מודגש
  semiBold: '600',  // משקל חצי-מודגש
  regular: '400',   // משקל רגיל
};

// קבועי ריווח — px ביחידות React Native
export const Spacing = {
  xs: 4,   // ריווח זעיר
  sm: 8,   // ריווח קטן
  md: 16,  // ריווח בינוני
  lg: 24,  // ריווח גדול
  xl: 32,  // ריווח גדול מאוד
  xxl: 48, // ריווח ענק
};
