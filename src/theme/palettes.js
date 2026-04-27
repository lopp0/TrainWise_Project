/**
 * שני פלטות צבעים לתמות האפליקציה.
 * ערכי המנטה/טיל/נייבי לקוחים מהלוגו (assets/images/wowowow.png).
 * ורוד (#E91E63) נשמר כצבע המותג בשתי התמות.
 */

// פלטת תמה כהה — רקע כהה עם פרטים בוהקים
export const darkPalette = {
  background: '#0A1628',         // רקע ראשי — כחול כהה עמוק
  cardBackground: '#132036',     // רקע של כרטיסיות
  cardBackgroundLight: '#1A2A44',// רקע כרטיסייה בהיר יותר
  primary: '#E91E63',            // צבע ראשי — ורוד מותג
  primaryLight: '#FF4081',       // גרסה בהירה של הצבע הראשי
  primaryDark: '#C2185B',        // גרסה כהה של הצבע הראשי
  accent: '#FF6090',             // צבע הדגשה
  textPrimary: '#FFFFFF',        // טקסט ראשי — לבן
  textSecondary: '#B0BEC5',      // טקסט משני — אפור-כחלחל
  textMuted: '#6C7A89',          // טקסט מושתק — אפור
  success: '#4CAF50',            // ירוק — הצלחה / עומס בטוח
  warning: '#FFC107',            // צהוב — אזהרה / עומס בינוני
  danger: '#F44336',             // אדום — סכנה / עומס גבוה
  border: '#1E3254',             // צבע גבולות
  inputBackground: '#0F1E36',    // רקע שדות קלט
  inputBorder: '#2A3F5F',        // גבול שדות קלט
  shadow: 'rgba(0, 0, 0, 0.3)', // צל אלמנטים
  overlay: 'rgba(10, 22, 40, 0.85)', // שכבת כיסוי מודאל
  green: '#4CAF50',              // קיצור לצבע ירוק
  yellow: '#FFC107',             // קיצור לצבע צהוב
  red: '#F44336',                // קיצור לצבע אדום
};

// פלטת תמה בהירה — רקע בהיר עם טיל/מנטה מהלוגו
export const lightPalette = {
  background: '#F5FBF9',         // רקע ראשי — לבן ירקרק
  cardBackground: '#FFFFFF',     // רקע כרטיסיות — לבן
  cardBackgroundLight: '#EAF6F1',// רקע כרטיסייה בהיר
  primary: '#3A8AA3',            // צבע ראשי — טיל מהלוגו
  primaryLight: '#7EE8C4',       // מנטה מהמגן בלוגו
  primaryDark: '#266375',        // גרסה כהה של הטיל
  accent: '#E91E63',             // ורוד המותג נשמר כהדגשה
  textPrimary: '#0D1F2D',        // טקסט ראשי — כמעט שחור
  textSecondary: '#3C4F5E',      // טקסט משני
  textMuted: '#7A8A96',          // טקסט מושתק
  success: '#1FAA6B',            // ירוק מותאם לתמה בהירה
  warning: '#E6A800',            // צהוב מותאם לתמה בהירה
  danger: '#D33F49',             // אדום מותאם לתמה בהירה
  border: '#D6ECE2',             // גבולות — ירקרק בהיר
  inputBackground: '#F0F8F5',    // רקע שדות קלט
  inputBorder: '#BFD9CD',        // גבול שדות קלט
  shadow: 'rgba(13, 31, 45, 0.08)',  // צל עדין
  overlay: 'rgba(13, 31, 45, 0.4)', // שכבת כיסוי מודאל
  green: '#1FAA6B',              // ירוק בהיר
  yellow: '#E6A800',             // צהוב בהיר
  red: '#D33F49',                // אדום בהיר
};

// מפה מתמה לפלטה — מאפשרת בחירה לפי שם: PALETTES['dark'] / PALETTES['light']
export const PALETTES = {
  dark: darkPalette,
  light: lightPalette,
};
