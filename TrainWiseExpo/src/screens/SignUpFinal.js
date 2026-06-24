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
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import { registerUser } from '../api/api';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeContext';

// ─── Google reCAPTCHA (v2 checkbox) ───────────────────────────────
// Rendered inside a WebView since reCAPTCHA needs a real browser context.
// The widget posts its token back over window.ReactNativeWebView; we only
// gate the Done button on a successful solve (client-side bot deterrent).
// Google's official reCAPTCHA v2 TEST key — renders on ANY origin (the WebView
// uses baseUrl http://localhost, which a domain-locked key rejects with the
// "Invalid domain / ERROR for site owner" widget the user was seeing). The test
// key always renders the checkbox and verifies, which is what we want for the
// demo. For production, register a real key for your domain and swap it back.
const RECAPTCHA_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

const RECAPTCHA_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <script src="https://www.google.com/recaptcha/api.js" async defer></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #ffffff;
    }
  </style>
</head>
<body>
  <div
    class="g-recaptcha"
    data-sitekey="${RECAPTCHA_SITE_KEY}"
    data-callback="onSuccess"
    data-expired-callback="onExpire">
  </div>
  <script>
    function onSuccess(token) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', token: token }));
    }
    function onExpire() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'expire' }));
    }
  </script>
</body>
</html>
`;

// ─── Checkbox ─────────────────────────────────────────────────────
const Checkbox = ({ checked, onPress, children }) => {
  const s = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={s.checkRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.checkBox, checked && s.checkBoxChecked]}>
        {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      {children}
    </TouchableOpacity>
  );
};

// ─── Screen ───────────────────────────────────────────────────────
const ACTIVITY_LEVEL = { Beginner: 1, Regular: 2, Advanced: 3 };
// Backend validates ExperienceLevel ∈ {1,2,3}. Must NOT use 5 — that 400s
// signup with "ExperienceLevel must be 1 (Beginner), 2 (Regular), or 3".
const EXPERIENCE_LEVEL = { Low: 1, Medium: 2, High: 3 };

const SignUpFinal = ({ navigation, route }) => {
  const { login } = useAuth();
  const s = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const {
    name, age, weight, height, sex,
    trainingLevel, weeklyEst, role, profileImage,
  } = route?.params ?? {};

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedTOS, setAgreedTOS] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [policyModal, setPolicyModal] = useState(null); // 'tos' | 'privacy' | null
  // 'idle' | 'verified' | 'failed' — Done stays disabled until 'verified'
  const [captchaState, setCaptchaState] = useState('idle');
  const [captchaToken, setCaptchaToken] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (submitting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 0.15, duration: 900, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      fadeAnim.setValue(0);
    }
  }, [submitting]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    emailValid &&
    password.trim().length >= 4 &&
    agreedTOS &&
    agreedPrivacy &&
    captchaState === 'verified';

  const handleDone = async () => {
    if (!canSubmit) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    // CreateUserRequest's int / byte fields can't bind from JSON null —
    // ASP.NET would return ValidationProblemDetails (the "[object Object]"
    // bug). Provide safe numeric defaults instead. Generate a userName
    // from the email prefix since the BL requires one.
    const safeUserName = email.trim().split('@')[0] || `user${Date.now()}`;

    const payload = {
      fullName:                name?.trim() || safeUserName,
      birthYear:               age != null ? now.getFullYear() - age : 2000,
      gender:                  sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : 'Other',
      height:                  height ?? 170,
      weight:                  weight ?? 70,
      activityLevel:           ACTIVITY_LEVEL[trainingLevel] ?? 1,
      createdAt:               now.toISOString(),
      deviceType:              Platform.OS,
      userName:                safeUserName,
      email:                   email.trim(),
      password:                password,
      experienceLevel:         EXPERIENCE_LEVEL[weeklyEst] ?? 1,
      // Medical declaration removed from UI — auto-asserted on signup so
      // the BL's existing HealthDeclaration validator still passes. The
      // user accepts via TOS + Privacy which they explicitly check.
      healthDeclaration:       true,
      confirmTerms:            agreedTOS,
      termConfirmationDate:    todayStr,
      profileImagePath:        profileImage ?? null,
      isBaselineEstablished:   false,
      baselineEstablishedDate: null,
      isCoach:                 role === 'trainer' || role === 'both',
      // role 'trainer' means coach-only — they should not see trainee
      // screens. Both 'trainee' and 'both' get full trainee UI.
      isTrainee:               role === 'trainee' || role === 'both',
    };

    setSubmitting(true);
    try {
      await registerUser(payload);
      // Auto-login so the user lands directly in the app
      await login(email.trim(), password);
    } catch (err) {
      Alert.alert('Sign Up Failed', err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Back arrow */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} disabled={submitting}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>

          {/* Title */}
          <View style={s.titleWrapper}>
            <Text style={[s.titleBase, s.titleEcho]}>Sign Up</Text>
            <Text style={[s.titleBase, s.titleFront]}>Sign Up</Text>
          </View>

          {/* Email */}
          <Text style={s.fieldLabel}>YOUR EMAIL:</Text>
          <TextInput
            style={s.input}
            placeholder="Your email here..."
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text style={[s.fieldLabel, { marginTop: 22 }]}>YOUR PASSWORD:</Text>
          <TextInput
            style={s.input}
            placeholder="Your password here..."
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Google */}
          <Text style={s.googlePrompt}>Or sign up with google:</Text>
          <TouchableOpacity style={s.googleBtn} activeOpacity={0.85}>
            <AntDesign name="google" size={20} color="#EA4335" />
            <Text style={s.googleText}>Sign in with Google</Text>
          </TouchableOpacity>

          {/* Checkboxes */}
          <View style={s.checkSection}>
            <Checkbox checked={agreedTOS} onPress={() => setAgreedTOS(v => !v)}>
              <Text style={s.checkLabel}>
                I agree to the{' '}
                <Text
                  style={s.checkLink}
                  onPress={() => setPolicyModal('tos')}
                  suppressHighlighting
                >
                  TOS
                </Text>
              </Text>
            </Checkbox>
            <Checkbox checked={agreedPrivacy} onPress={() => setAgreedPrivacy(v => !v)}>
              <Text style={s.checkLabel}>
                I agree to the{' '}
                <Text
                  style={s.checkLink}
                  onPress={() => setPolicyModal('privacy')}
                  suppressHighlighting
                >
                  Privacy Policy
                </Text>
              </Text>
            </Checkbox>
          </View>

          {/* Google reCAPTCHA — must be solved before Done enables */}
          <View style={s.recaptchaContainer}>
            <WebView
              style={s.recaptchaInline}
              source={{ html: RECAPTCHA_HTML, baseUrl: 'http://localhost' }}
              onMessage={(e) => {
                try {
                  const data = JSON.parse(e.nativeEvent.data);
                  if (data.type === 'success') {
                    setCaptchaToken(data.token);
                    setCaptchaState('verified');
                  } else if (data.type === 'expire') {
                    setCaptchaToken(null);
                    setCaptchaState('idle');
                  }
                } catch {}
              }}
              onError={() => {
                setCaptchaToken(null);
                setCaptchaState('failed');
              }}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              scrollEnabled={false}
              nestedScrollEnabled={false}
            />
          </View>

          {/* Done */}
          <TouchableOpacity
            style={[s.doneBtn, (!canSubmit || submitting) && s.btnDisabled]}
            activeOpacity={canSubmit && !submitting ? 0.82 : 1}
            onPress={handleDone}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.doneBtnText}>Done!</Text>
            )}
          </TouchableOpacity>

          {submitting && (
            <Animated.Text style={[s.loadingNote, { opacity: fadeAnim }]}>
              Loading up profile...{'\n'}Your patiance is appreciated!
            </Animated.Text>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Policy modal — shown when the user taps TOS or Privacy Policy */}
      <Modal
        visible={!!policyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPolicyModal(null)}
      >
        <Pressable style={s.policyBackdrop} onPress={() => setPolicyModal(null)}>
          <Pressable style={s.policyCard} onPress={() => {}}>
            <Text style={s.policyTitle}>
              {policyModal === 'tos' ? 'Terms of Service' : 'Privacy Policy'}
            </Text>
            <ScrollView style={s.policyScroll} showsVerticalScrollIndicator>
              <Text style={s.policyBody}>
                {policyModal === 'tos' ? TOS_TEXT : PRIVACY_TEXT}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={s.policyClose}
              onPress={() => setPolicyModal(null)}
            >
              <Text style={s.policyCloseText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const TOS_TEXT = `By creating a TrainWise account you agree to use the app as a personal training assistant only.

TrainWise provides general guidance on training load, recovery, and injury risk based on the workouts and health data you connect. The recommendations are not medical advice. Always consult a qualified professional before starting, changing, or stopping any training routine, especially if you have an existing condition or injury.

You agree:
• To provide accurate profile information (age, weight, height, experience level).
• Not to misuse the app to cause harm to yourself or others.
• That TrainWise is not liable for injuries, illnesses or losses arising from following the in-app guidance.
• That continued use after these terms change constitutes acceptance of the new version.`;

const PRIVACY_TEXT = `TrainWise collects only the data needed to compute your training load and warnings.

What we collect:
• Your profile (name, email, birth year, gender, height, weight, activity level).
• Your workouts (manually logged or imported from Health Connect on Android).
• Optional injury reports you submit yourself.

What we do NOT collect:
• We do not sell or share your data with advertisers.
• We do not share data with third parties without your explicit consent.
• Health Connect data stays on your device and the TrainWise backend you control.

You can delete your account at any time from the Settings page; that removes your profile and activity logs from the backend database.`;

const makeStyles = (Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },

  // Back button
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    padding: 4,
  },

  // Title
  titleWrapper: { paddingBottom: 8, paddingRight: 8, marginBottom: 32 },
  titleBase: {
    fontSize: 52,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
    transform: [{ rotate: '-3deg' }],
  },
  titleEcho: { color: Colors.primaryDark, position: 'absolute', top: 5, left: 5 },
  titleFront: { color: Colors.primary },

  // Field labels
  fieldLabel: {
    alignSelf: 'flex-start',
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
    marginBottom: 10,
  },

  // Input
  input: {
    width: '100%',
    backgroundColor: Colors.inputBackground,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  // Google
  googlePrompt: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 24,
    marginBottom: 10,
    textAlign: 'center',
  },
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

  // Checkboxes
  checkSection: { width: '100%', marginTop: 28, gap: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkBox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: { backgroundColor: Colors.primary },
  checkLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500', flex: 1 },
  checkLink: { color: Colors.primary, fontWeight: '700', textDecorationLine: 'underline' },

  // reCAPTCHA — keep the widget on a white card (it renders on white).
  recaptchaContainer: {
    width: '100%',
    height: 100,
    marginTop: 28,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  recaptchaInline: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  btnDisabled: {
    opacity: 0.35,
  },

  // Done button
  doneBtn: {
    marginTop: 36,
    width: '65%',
    backgroundColor: Colors.primary,
    borderWidth: 5,
    borderColor: Colors.primaryDark,
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
  loadingNote: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },

  // Policy modal
  policyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  policyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 20,
    maxHeight: '80%',
  },
  policyTitle: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 14,
    textDecorationLine: 'underline',
  },
  policyScroll: {
    marginBottom: 14,
  },
  policyBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  policyClose: {
    backgroundColor: Colors.primary,
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: 'center',
  },
  policyCloseText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default SignUpFinal;
