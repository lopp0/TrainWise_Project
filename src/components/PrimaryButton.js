// כפתור ראשי אחיד — משמש בכל המסכים לפעולות עיקריות
import React from 'react';
// TouchableOpacity לאינטראקציה, Text לטקסט, StyleSheet לסגנונות, ActivityIndicator לטעינה
import {TouchableOpacity, Text, StyleSheet, ActivityIndicator} from 'react-native';
// ייבוא צבעים, גופנים וריווחים מהתמה
import {Colors, Fonts, Spacing} from '../theme/colors';

// PrimaryButton — props:
// title: טקסט הכפתור
// onPress: פונקציה שתופעל בלחיצה
// loading: אם true — מציג spinner במקום טקסט
// disabled: אם true — הכפתור לא לחיץ
// style: סגנון נוסף מבחוץ
const PrimaryButton = ({title, onPress, loading, disabled, style}) => {
  return (
    <TouchableOpacity
      // [styles.button, disabled && styles.disabled, style] — ממזג סגנונות
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={onPress}
      // מנטרל את הכפתור גם בזמן טעינה וגם כשהוא מושבת
      disabled={loading || disabled}
      activeOpacity={0.8}> {/* שקיפות קלה בלחיצה */}
      {loading ? (
        // בזמן טעינה — מציג spinner לבן
        <ActivityIndicator color={Colors.textPrimary} />
      ) : (
        // במצב רגיל — מציג את הטקסט
        <Text style={styles.text}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

// סגנונות הכפתור
const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,          // רקע בצבע המותג
    borderRadius: 12,                          // פינות מעוגלות
    paddingVertical: 14,                       // ריפוד אנכי
    paddingHorizontal: Spacing.xl,             // ריפוד אופקי
    alignItems: 'center',                      // מרכז את התוכן אופקית
    justifyContent: 'center',                  // מרכז את התוכן אנכית
    marginHorizontal: Spacing.lg,              // ריווח צדדי
    marginVertical: Spacing.sm,                // ריווח אנכי
    shadowColor: Colors.primary,               // צל בצבע הכפתור עצמו (אפקט זוהר)
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabled: {
    opacity: 0.5, // הכפתור המושבת נראה שקוף למחצה
  },
  text: {
    color: Colors.textPrimary,         // טקסט לבן
    fontSize: Fonts.bodySize,          // גודל טקסט גוף
    fontWeight: Fonts.bold,            // מודגש
    textTransform: 'uppercase',        // אותיות גדולות
    letterSpacing: 1,                  // ריווח בין אותיות לאסתטיקה
  },
});

export default PrimaryButton;
