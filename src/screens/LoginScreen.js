// מסך כניסה — טופס אימייל + סיסמה לכניסה לחשבון קיים
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView, // מזיז את המסך כלפי מעלה כשהמקלדת עולה
  ScrollView,
  Platform,             // זיהוי מערכת הפעלה (iOS/Android)
  Alert,
  ActivityIndicator,
} from 'react-native';
// SafeAreaView מגן מפני notch ו-home bar
import { SafeAreaView } from 'react-native-safe-area-context';
// שליטה בסגנון שורת הסטטוס
import { StatusBar } from 'expo-status-bar';
// פונקציית login מה-AuthContext
import { useAuth } from '../api/AuthContext';

const LoginScreen = ({ navigation }) => {
  // שליפת פונקציית login מה-Context
  const { login } = useAuth();
  // מצב שדה האימייל
  const [email, setEmail] = useState('');
  // מצב שדה הסיסמה
  const [password, setPassword] = useState('');
  // האם הכניסה בתהליך (להצגת spinner)
  const [loading, setLoading] = useState(false);

  // מטפל בלחיצה על "Sign in"
  const handleLogin = async () => {
    // וידוא שהשדות לא ריקים
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      // קריאת ה-API — אם מצליח, AuthContext מעדכן את isLoggedIn ו-NavigationStack מנווט אוטומטית
      await login(email.trim(), password);
    } catch (err) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials. Please try again.');
    } finally {
      // הסרת spinner בכל מקרה
      setLoading(false);
    }
  };

  return (
    // SafeAreaView עם edges מפורשים לתאימות עם iPhone + Android
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      {/* KeyboardAvoidingView מונע מהמקלדת לכסות את טופס ההתחברות */}
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"   // מאפשר לחיצה על כפתורים גם כשהמקלדת פתוחה
          showsVerticalScrollIndicator={false}
        >
          {/* שורת כותרת עם לוגו משני הצדדים */}
          <View style={styles.titleRow}>
            <Image
              source={require('../../assets/images/wowowow.png')}
              style={styles.titleIcon}
              resizeMode="contain"
            />
            {/* כותרת עם אפקט "echo" — שתי שכבות טקסט מוזזות */}
            <View style={styles.titleWrapper}>
              {/* שכבת הצל — אחורה */}
              <Text style={[styles.titleBase, styles.titleEcho]} numberOfLines={1}>
                Sign in
              </Text>
              {/* שכבת החזית — קדימה */}
              <Text style={[styles.titleBase, styles.titleFront]} numberOfLines={1}>
                Sign in
              </Text>
            </View>
            <Image
              source={require('../../assets/images/wowowow.png')}
              style={styles.titleIcon}
              resizeMode="contain"
            />
          </View>

          {/* תווית שדה אימייל */}
          <Text style={styles.fieldLabel}>YOUR EMAIL:</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Email here..."
            placeholderTextColor="#a0a0a0"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"  // מקלדת מותאמת לאימייל
            autoCapitalize="none"          // ללא הגדלת אות ראשונה אוטומטית
            autoCorrect={false}
          />

          {/* תווית שדה סיסמה */}
          <Text style={[styles.fieldLabel, { marginTop: 22 }]}>YOUR PASSWORD:</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password here..."
            placeholderTextColor="#a0a0a0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry     // מסתיר את הסיסמה
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* כפתור כניסה — מראה spinner בזמן טעינה */}
          <TouchableOpacity
            style={[styles.signInButton, loading && styles.signInButtonDisabled]}
            activeOpacity={0.82}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signInButtonText}>Sign in</Text>
            )}
          </TouchableOpacity>

          {/* שורת "שכחתי סיסמה" — כרגע לא ממומשת */}
          <View style={styles.resetRow}>
            <Text style={styles.resetPrompt}>{"CAN'T LOG IN?\nRESET PASSWORD "}</Text>
            <TouchableOpacity activeOpacity={0.75}>
              <Text style={styles.resetHere}>HERE!</Text>
            </TouchableOpacity>
          </View>

          {/* שורת מעבר להרשמה */}
          <View style={styles.signUpRow}>
            <Text style={styles.signUpPrompt}>NEW HERE? </Text>
            <TouchableOpacity activeOpacity={0.75} onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signUpLink}>CREATE AN ACCOUNT</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// סגנונות מסך הכניסה
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#13173d',   // רקע כחול כהה של אפליקציית TrainWise
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  // שורת הכותרת עם הלוגו
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 36,
  },
  titleIcon: {
    width: 38,
    height: 38,
  },
  titleWrapper: {
    paddingBottom: 6,
    paddingRight: 6,
  },
  // בסיס הכותרת — נגדיל ונגדיר בשתי שכבות
  titleBase: {
    fontSize: 46,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  // שכבת הצל — סגולה, מוזזת ימינה ולמטה
  titleEcho: {
    color: '#c524e6',
    position: 'absolute',
    top: 6,
    left: 6,
  },
  // שכבת החזית — ורוד בהיר
  titleFront: {
    color: '#ff2c60',
  },
  // תוויות שדות
  fieldLabel: {
    alignSelf: 'flex-start',
    color: '#ff2c60',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
    marginBottom: 8,
  },
  // שדות קלט
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#87ffd7',        // גבול ירקרק מנטה
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#13173d',
  },
  // כפתור כניסה
  signInButton: {
    marginTop: 28,
    width: '100%',
    backgroundColor: '#ff2c60',
    borderWidth: 6,
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
  // מצב מושבת — שקוף למחצה
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    fontStyle: 'italic',
  },
  // שורת "שכחתי סיסמה"
  resetRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  resetPrompt: {
    color: '#ff2c60',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  resetHere: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
  },
  // שורת מעבר להרשמה
  signUpRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpPrompt: {
    color: '#a0a0c0',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  signUpLink: {
    color: '#ff2c60',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
  },
  // כפתור Google (לא פעיל כרגע — נשמר לשימוש עתידי)
  googleButton: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  googleText: {
    color: '#3c3c3c',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default LoginScreen;
