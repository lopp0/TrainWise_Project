// קומפוננט כרטיסייה — עיצוב אחיד לכל ה"כרטיסים" באפליקציה
import React from 'react';
// View לקונטיינר, StyleSheet ליצירת סגנונות
import {View, StyleSheet} from 'react-native';
// ייבוא צבעים וריווחים מהתמה הגלובלית
import {Colors, Spacing} from '../theme/colors';

// Card מקבל children (תוכן פנימי) ו-style אופציונלי לעיצוב נוסף מבחוץ
const Card = ({children, style}) => {
  // [styles.card, style] — ממזג את הסגנון הבסיסי עם כל סגנון חיצוני
  return <View style={[styles.card, style]}>{children}</View>;
};

// הגדרת הסגנון הקבוע של הכרטיסייה
const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,  // צבע רקע מהתמה
    borderRadius: 16,                         // פינות מעוגלות
    padding: Spacing.lg,                      // ריפוד פנימי אחיד (24px)
    marginHorizontal: Spacing.lg,             // ריווח צדדי (24px)
    marginBottom: Spacing.md,                 // ריווח תחתון בין כרטיסיות (16px)
    shadowColor: Colors.shadow,               // צבע הצל
    shadowOffset: {width: 0, height: 4},      // כיוון הצל — לתחתית
    shadowOpacity: 0.3,                       // שקיפות הצל
    shadowRadius: 8,                          // טשטוש הצל
    elevation: 6,                             // עומק צל ב-Android
  },
});

export default Card;
