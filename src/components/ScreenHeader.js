// כותרת מסך אחידה — מציגה כותרת, כיתוב וכפתור חזרה אופציונלי
import React from 'react';
// View לקונטיינר, Text לטקסטים, StyleSheet לסגנונות, TouchableOpacity לכפתור
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
// ייבוא צבעים, גופנים וריווחים מהתמה
import {Colors, Fonts, Spacing} from '../theme/colors';

// ScreenHeader — props:
// title: כותרת ראשית
// subtitle: כיתוב קטן מתחת (אופציונלי)
// onBack: פונקציה לחזרה — אם קיימת, מציגה כפתור "<" משמאל
const ScreenHeader = ({title, subtitle, onBack}) => {
  return (
    // קונטיינר הכותרת
    <View style={styles.container}>
      {/* כפתור חזרה מוצג רק אם onBack הועברה */}
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          {/* "<" כסמל חזרה */}
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
      )}
      {/* כותרת ראשית */}
      <Text style={styles.title}>{title}</Text>
      {/* כיתוב משני — מוצג רק אם subtitle קיים */}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

// סגנונות הכותרת
const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.xl,          // ריווח עליון גדול
    paddingBottom: Spacing.md,       // ריווח תחתון
    paddingHorizontal: Spacing.lg,   // ריווח צדדי
    alignItems: 'center',            // מרכוז אופקי של הכותרת
  },
  backButton: {
    position: 'absolute',            // ממוקם מחוץ לזרימה הרגילה
    left: Spacing.md,                // צמוד לשמאל
    top: Spacing.xl,                 // גובה זהה לכותרת
    padding: Spacing.sm,             // אזור לחיצה גדול יותר
  },
  backText: {
    color: Colors.primary,           // צבע מותג
    fontSize: 24,                    // גודל בולט
    fontWeight: Fonts.bold,
  },
  title: {
    fontSize: Fonts.titleSize,       // גודל כותרת ראשית (28px)
    fontWeight: Fonts.bold,
    color: Colors.primary,           // צבע מותג
    textAlign: 'center',
    fontStyle: 'italic',             // נטוי לפי סגנון האפליקציה
  },
  subtitle: {
    fontSize: Fonts.captionSize,     // גודל קטן (12px)
    color: Colors.textSecondary,
    marginTop: Spacing.xs,           // ריווח קטן מהכותרת
    textAlign: 'center',
  },
});

export default ScreenHeader;
