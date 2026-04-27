// מסך סיום הרשמה — אימייל, סיסמה, הסכמות וכפתור "Done"
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,       // אנימציית pulse בזמן שליחה
} from 'react-native';
// SafeAreaView — מגן על notch ובר תחתון
import { SafeAreaView } from 'react-native-safe-area-context';
// שליטה בשורת הסטטוס
import { StatusBar } from 'expo-status-bar';
// אייקוני ✓ וחיצים
import { Ionicons, AntDesign } from '@expo/vector-icons';
// login מה-AuthContext — לכניסה אוטומטית לאחר הרשמה
import { useAuth } from '../api/AuthContext';
// registerUser — שליחת DTO לשרת
import { registerUser } from '../api/api';

// ─── קומפוננט Checkbox — תיבת סימון מותאמת ───────────────────────
// props: checked (boolean), onPress (callback), children (תווית)
const Checkbox = ({ checked, onPress, children }) => (
  <TouchableOpacity style={s.checkRow} onPress={onPress} activeOpacity={0.75}>
    {/* ריבוע הסימון — אדום כשמסומן */}
    <View style={[s.checkBox, checked && s.checkBoxChecked]}>
      {/* ✓ מוצג רק כשמסומן */}
      {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
    </View>
    {/* תוכן התווית */}
    {children}
  </TouchableOpacity>
);

// ─── מפות המרה מטקסט לערכים נומריים ─────────────────────────────
// רמת פעילות: מילה → ערך נומרי לשרת
const ACTIVITY_LEVEL = { Beginner: 1, Regular: 2, Advanced: 3 };
// רמת ניסיון: מילה → ערך נומרי לשרת
const EXPERIENCE_LEVEL = { Low: 1, Medium: 3, High: 5 };

const SignUpFinal = ({ navigation, route }) => {
  // login — לכניסה אוטומטית לאחר הרשמה מוצלחת
  const { login } = useAuth();
  // פרמטרים שהועברו ממסכי ההרשמה הקודמים
  const {
    name, age, weight, height, sex,
    trainingLevel, weeklyEst, role, profileImage,
  } = route?.params ?? {};

  // שדות הטופס
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // שלוש הסכמות — חייבות להיות מסומנות לפני שליחה
  const [agreedTOS, setAgreedTOS] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedMedical, setAgreedMedical] = useState(false);
  // האם שליחה בתהליך — חוסם כפתור ומפעיל ספינר
  const [submitting, setSubmitting] = useState(false);
  // ערך אנימציה לאפקט pulse בזמן שליחה
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // אנימציית pulse — פועלת כל עוד submitting=true
  useEffect(() => {
    if (submitting) {
      const pulse = Animated.loop(
        Animated.sequence([
          // דעיכה מלאה
          Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          // דעיכה כמעט מלאה
          Animated.timing(fadeAnim, { toValue: 0.15, duration: 900, useNativeDriver: true }),
        ])
      );
      pulse.start();
      // ניקוי האנימציה כשמפסיקים לשלוח
      return () => pulse.stop();
    } else {
      // איפוס opacity לאפס כשאין שליחה
      fadeAnim.setValue(0);
    }
  }, [submitting]);

  // regex לאימות פורמט אימייל בסיסי
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // כפתור Done פעיל רק אם כל התנאים מתקיימים
  const canSubmit =
    emailValid &&
    password.trim().length > 0 &&
    agreedTOS &&
    agreedPrivacy &&
    agreedMedical;

  // שליחת טופס ההרשמה
  const handleDone = async () => {
    if (!canSubmit) return;

    const now = new Date();
    // תאריך היום בפורמט YYYY-MM-DD לשדה termConfirmationDate
    const todayStr = now.toISOString().split('T')[0];

    // בניית ה-DTO — ממירים את ערכי הסקר לפורמט שהשרת מצפה
    const payload = {
      fullName:                name ?? null,
      // גיל → שנת לידה: שנה נוכחית פחות הגיל
      birthYear:               age != null ? now.getFullYear() - age : null,
      // מגדר: ממפה 'male'/'female' לאנגלית גדולה
      gender:                  sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : null,
      height:                  height ?? null,
      weight:                  weight ?? null,
      // רמת פעילות: ממיר מחרוזת לנומרי
      activityLevel:           ACTIVITY_LEVEL[trainingLevel] ?? null,
      createdAt:               now.toISOString(),
      // סוג מכשיר: 'android' או 'ios' לפי מה שרץ בפועל
      deviceType:              Platform.OS,
      userName:                null,
      email:                   email.trim(),
      password:                password,
      // רמת ניסיון: ממיר מחרוזת לנומרי
      experienceLevel:         EXPERIENCE_LEVEL[weeklyEst] ?? null,
      healthDeclaration:       agreedMedical,
      confirmTerms:            agreedTOS,
      termConfirmationDate:    todayStr,
      profileImagePath:        profileImage ?? null,
      // baseline טרם הוקם בהרשמה ראשונית
      isBaselineEstablished:   false,
      baselineEstablishedDate: null,
      // isCoach: אמת אם תפקיד 'trainer' או 'both'
      isCoach:                 role === 'trainer' || role === 'both',
    };

    setSubmitting(true);
    try {
      // רישום המשתמש בשרת
      await registerUser(payload);
      // כניסה אוטומטית — המשתמש נכנס ישירות לאפליקציה ללא מסך Login
      await login(email.trim(), password);
    } catch (err) {
      Alert.alert('Sign Up Failed', err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      {/* KeyboardAvoidingView — מונע מהמקלדת לכסות שדות */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"   // לחיצה על כפתור סוגרת מקלדת
          showsVerticalScrollIndicator={false}
        >

          {/* חץ חזרה — מושבת בזמן שליחה */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} disabled={submitting}>
            <Ionicons name="arrow-back" size={24} color="#ff2c60" />
          </TouchableOpacity>

          {/* כותרת "Sign Up" עם אפקט echo (שתי שכבות) */}
          <View style={s.titleWrapper}>
            {/* שכבת הצל — סגולה, מוזזת */}
            <Text style={[s.titleBase, s.titleEcho]}>Sign Up</Text>
            {/* שכבת החזית — ורוד */}
            <Text style={[s.titleBase, s.titleFront]}>Sign Up</Text>
          </View>

          {/* שדה אימייל */}
          <Text style={s.fieldLabel}>YOUR EMAIL:</Text>
          <TextInput
            style={s.input}
            placeholder="Your email here..."
            placeholderTextColor="rgba(19,23,61,0.35)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* שדה סיסמה */}
          <Text style={[s.fieldLabel, { marginTop: 22 }]}>YOUR PASSWORD:</Text>
          <TextInput
            style={s.input}
            placeholder="Your password here..."
            placeholderTextColor="rgba(19,23,61,0.35)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry          // הסתרת הסיסמה
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* כניסה עם Google (כפתור UI בלבד — לא ממומש) */}
          <Text style={s.googlePrompt}>Or sign up with google:</Text>
          <TouchableOpacity style={s.googleBtn} activeOpacity={0.85}>
            <AntDesign name="google" size={20} color="#EA4335" />
            <Text style={s.googleText}>Sign in with Google</Text>
          </TouchableOpacity>

          {/* קטע הסכמות — שלושה Checkboxes */}
          <View style={s.checkSection}>
            {/* הסכמה לתנאי שימוש */}
            <Checkbox checked={agreedTOS} onPress={() => setAgreedTOS(v => !v)}>
              <Text style={s.checkLabel}>
                I agree to the <Text style={s.checkLink}>TOS</Text>
              </Text>
            </Checkbox>
            {/* הסכמה למדיניות פרטיות */}
            <Checkbox checked={agreedPrivacy} onPress={() => setAgreedPrivacy(v => !v)}>
              <Text style={s.checkLabel}>
                I agree to the <Text style={s.checkLink}>Privacy Policy</Text>
              </Text>
            </Checkbox>
            {/* הצהרה רפואית */}
            <Checkbox checked={agreedMedical} onPress={() => setAgreedMedical(v => !v)}>
              <Text style={s.checkLabel}>I have a medical agreement</Text>
            </Checkbox>
          </View>

          {/* כפתור Done — מושבת כשהטופס לא תקין או בשליחה */}
          <TouchableOpacity
            style={[s.doneBtn, (!canSubmit || submitting) && s.btnDisabled]}
            activeOpacity={canSubmit && !submitting ? 0.82 : 1}
            onPress={handleDone}
            disabled={!canSubmit || submitting}
          >
            {/* ספינר בזמן שליחה; טקסט "Done!" בשאר הזמן */}
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.doneBtnText}>Done!</Text>
            )}
          </TouchableOpacity>

          {/* הודעת "loading" עם אנימציית pulse — מוצגת בזמן שליחה */}
          {submitting && (
            <Animated.Text style={[s.loadingNote, { opacity: fadeAnim }]}>
              Loading up profile...{'\n'}Your patiance is appreciated!
            </Animated.Text>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// סגנונות המסך
const s = StyleSheet.create({
  // רקע כחול כהה — עקבי עם WelcomeScreen
  safe: { flex: 1, backgroundColor: '#13173d' },
  // גלילה מרכוזית עם padding
  scroll: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },

  // כפתור חזרה
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    padding: 4,
  },

  // עטיפת כותרת — לפריסה של שתי שכבות
  titleWrapper: { paddingBottom: 8, paddingRight: 8, marginBottom: 32 },
  // בסיס כותרת — משותף לשתי השכבות
  titleBase: {
    fontSize: 52,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
    transform: [{ rotate: '-3deg' }],  // הטיה קלה לאפקט ויזואלי
  },
  // שכבת הצל — סגולה, מוזזת ימינה ולמטה
  titleEcho: { color: '#c524e6', position: 'absolute', top: 5, left: 5 },
  // שכבת החזית — ורוד
  titleFront: { color: '#ff2c60' },

  // תוויות שדה (YOUR EMAIL, YOUR PASSWORD)
  fieldLabel: {
    alignSelf: 'flex-start',
    color: '#ff2c60',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
    marginBottom: 10,
  },

  // שדה קלט — רקע לבן עם מסגרת מנטה
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#87ffd7',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#13173d',
  },

  // טקסט "Or sign up with google"
  googlePrompt: {
    color: '#a0a0c0',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 10,
    textAlign: 'center',
  },
  // כפתור Google — לבן עם צל
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 10,
    width: '100%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  googleText: { color: '#3c3c3c', fontSize: 15, fontWeight: '600' },

  // קטע הסכמות
  checkSection: { width: '100%', marginTop: 28, gap: 16 },
  // שורת Checkbox
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // ריבוע הסימון — מסגרת אדומה
  checkBox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#ff2c60',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ריבוע מסומן — רקע אדום
  checkBoxChecked: { backgroundColor: '#ff2c60' },
  checkLabel: { color: '#ffffff', fontSize: 13, fontWeight: '500', flex: 1 },
  // קישור בתוך תווית (TOS, Privacy Policy)
  checkLink: { color: '#ff2c60', fontWeight: '700', textDecorationLine: 'underline' },

  // כפתור מושבת — שקיפות גבוהה
  btnDisabled: {
    opacity: 0.35,
  },

  // כפתור Done — אדום עם מסגרת סגולה
  doneBtn: {
    marginTop: 36,
    width: '65%',
    backgroundColor: '#ff2c60',
    borderWidth: 5,
    borderColor: '#c524e6',
    borderRadius: 32,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  // הודעת pulse בזמן שליחה
  loadingNote: {
    color: '#a0a0c0',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },
});

export default SignUpFinal;
