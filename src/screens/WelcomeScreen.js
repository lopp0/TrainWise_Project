// מסך ברוכים הבאים — הכניסה הראשונה לאפליקציה, עם טקסט מעוקל סביב הלוגו
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
// SafeAreaView מגן מפני notch
import { SafeAreaView } from 'react-native-safe-area-context';
// שליטה בשורת הסטטוס
import { StatusBar } from 'expo-status-bar';

// רוחב המסך לחישוב פקסמים
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// רדיוס עיגול הטקסט המעוקל — כ-118px מהמרכז
const CIRCLE_RADIUS = 118;
// גודל הלוגו במרכז
const LOGO_SIZE = 160;
// גודל גופן האותיות המעוקלות
const FONT_SIZE = 14;
// גודל הקונטיינר: רדיוס + גופן + padding × 2
const CONTAINER_SIZE = (CIRCLE_RADIUS + FONT_SIZE + 14) * 2;

/**
 * CurvedText — קומפוננט שמציג טקסט מעוקל סביב מעגל.
 * @param {string} text - הטקסט להצגה
 * @param {number} radius - רדיוס הקשת
 * @param {boolean} curveUp - true = מעל המרכז, false = מתחת
 */
function CurvedText({ text, radius, curveUp }) {
  // פיצול לתווים בודדים — כל תו ימוקם בנפרד על הקשת
  const chars = text.split('');
  // הצעד הזוויתי בין תווים — מבוסס על רוחב גופן משוער
  const charStep = (FONT_SIZE * 0.62) / radius;
  // הזווית הכוללת של כל הטקסט
  const totalAngle = charStep * chars.length;
  // מרכז הקונטיינר
  const cx = CONTAINER_SIZE / 2;
  const cy = CONTAINER_SIZE / 2;

  // זווית התחלה — מרכוז הטקסט על הקשת
  const startAngle = curveUp
    ? -Math.PI / 2 - totalAngle / 2   // מעל: מתחיל מ-90° שמאלה
    : Math.PI / 2 - totalAngle / 2;   // מתחת: מתחיל מ-90° ימינה

  return (
    <>
      {chars.map((char, i) => {
        // זווית התו ה-i
        const angle = startAngle + charStep * (i + 0.5);
        // מיקום x, y על הקשת (קואורדינטות קרטזיות)
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        // סיבוב התו כדי שיהיה ישיר לרדיוס (90°/270°)
        const rotDeg = curveUp
          ? (angle * 180) / Math.PI + 90
          : (angle * 180) / Math.PI - 90;

        return (
          <Text
            key={`c-${i}`}
            style={{
              position: 'absolute',
              left: px - FONT_SIZE * 0.32,
              // כוונון אנכי: טקסט עליון מוצב מעל, תחתון — מתחת
              top: curveUp ? py - FONT_SIZE : py,
              fontSize: FONT_SIZE,
              color: '#00e6c3',       // מנטה בהיר
              fontWeight: '700',
              transform: [{ rotate: `${rotDeg}deg` }],  // סיבוב לפי הזווית
            }}
          >
            {char}
          </Text>
        );
      })}
    </>
  );
}

// מסך ברוכים הבאים
const WelcomeScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* כותרת "Trainwise" עם אפקט echo (שתי שכבות) */}
      <View style={styles.titleWrapper}>
        {/* שכבת הצל — סגולה, מוזזת */}
        <Text style={[styles.titleBase, styles.titleEcho]} numberOfLines={1}>
          Trainwise
        </Text>
        {/* שכבת החזית — ורוד */}
        <Text style={[styles.titleBase, styles.titleFront]} numberOfLines={1}>
          Trainwise
        </Text>
      </View>

      {/* עיגול הלוגו עם הטקסט המעוקל */}
      <View
        style={[
          styles.circleContainer,
          { width: CONTAINER_SIZE, height: CONTAINER_SIZE },
        ]}
      >
        {/* לוגו במרכז — ממורכז בחישוב מפורש */}
        <Image
          source={require('../../assets/images/wowowow.png')}
          style={[
            styles.logo,
            {
              width: LOGO_SIZE,
              height: LOGO_SIZE,
              top: (CONTAINER_SIZE - LOGO_SIZE) / 2,
              left: (CONTAINER_SIZE - LOGO_SIZE) / 2,
            },
          ]}
          resizeMode="contain"
        />
        {/* טקסט עליון מעוקל */}
        <CurvedText text="Protect your health" radius={CIRCLE_RADIUS} curveUp={true} />
        {/* טקסט תחתון מעוקל */}
        <CurvedText text="and your safety" radius={CIRCLE_RADIUS} curveUp={false} />
      </View>

      {/* כפתור הרשמה */}
      <TouchableOpacity
        style={styles.signUpButton}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('SignUp')}
      >
        <Text style={styles.signUpText}>Sign Up</Text>
      </TouchableOpacity>

      {/* שורת מעבר לכניסה */}
      <View style={styles.signInRow}>
      <Text style={styles.signInPrompt}>ALREADY HAVE AN ACCOUNT?  SIGN IN </Text>
      <TouchableOpacity activeOpacity={0.75} onPress={() => navigation.navigate('Login')} >
      <Text style={styles.signInHere}>HERE!</Text>
      </TouchableOpacity>
      </View>
     </SafeAreaView>
  );
};

// סגנונות מסך הברכה
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#13173d',     // רקע כחול כהה
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // עטיפת הכותרת — padding להתאמת גודל
  titleWrapper: {
    paddingBottom: 8,
    paddingRight: 8,
    marginBottom: 16,
  },
  // בסיס הכותרת
  titleBase: {
    fontSize: 52,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1.5,
  },
  // שכבת הצל — סגולה, מוזזת ימינה ולמטה
  titleEcho: {
    color: '#c524e6',
    position: 'absolute',
    top: 6,
    left: 6,
  },
  // שכבת החזית — ורוד
  titleFront: {
    color: '#ff2c60',
  },
  // קונטיינר עיגול הלוגו — מיקום יחסי לאלמנטים מוחלטים
  circleContainer: {
    position: 'relative',
    marginBottom: 28,
  },
  // הלוגו — מיקום מוחלט במרכז הקונטיינר
  logo: {
    position: 'absolute',
  },
  // כפתור הרשמה
  signUpButton: {
    backgroundColor: '#ff2c60',
    borderWidth: 6,
    borderColor: '#c524e6',
    borderRadius: 32,
    paddingVertical: 14,
    // רוחב יחסי למסך
    paddingHorizontal: SCREEN_WIDTH * 0.18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  signUpText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // שורת "יש לי חשבון"
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  signInPrompt: {
    color: '#ff2c60',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  signInHere: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
  },
});

export default WelcomeScreen;
