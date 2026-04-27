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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import { registerUser } from '../api/api';

// ─── Checkbox ─────────────────────────────────────────────────────
const Checkbox = ({ checked, onPress, children }) => (
  <TouchableOpacity style={s.checkRow} onPress={onPress} activeOpacity={0.75}>
    <View style={[s.checkBox, checked && s.checkBoxChecked]}>
      {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
    </View>
    {children}
  </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────
const ACTIVITY_LEVEL = { Beginner: 1, Regular: 2, Advanced: 3 };
const EXPERIENCE_LEVEL = { Low: 1, Medium: 3, High: 5 };

const SignUpFinal = ({ navigation, route }) => {
  const { login } = useAuth();
  const {
    name, age, weight, height, sex,
    trainingLevel, weeklyEst, role, profileImage,
  } = route?.params ?? {};

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedTOS, setAgreedTOS] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedMedical, setAgreedMedical] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
    password.trim().length > 0 &&
    agreedTOS &&
    agreedPrivacy &&
    agreedMedical;

  const handleDone = async () => {
    if (!canSubmit) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    const payload = {
      fullName:                name ?? null,
      birthYear:               age != null ? now.getFullYear() - age : null,
      gender:                  sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : null,
      height:                  height ?? null,
      weight:                  weight ?? null,
      activityLevel:           ACTIVITY_LEVEL[trainingLevel] ?? null,
      createdAt:               now.toISOString(),
      deviceType:              Platform.OS,
      userName:                null,
      email:                   email.trim(),
      password:                password,
      experienceLevel:         EXPERIENCE_LEVEL[weeklyEst] ?? null,
      healthDeclaration:       agreedMedical,
      confirmTerms:            agreedTOS,
      termConfirmationDate:    todayStr,
      profileImagePath:        profileImage ?? null,
      isBaselineEstablished:   false,
      baselineEstablishedDate: null,
      isCoach:                 role === 'trainer' || role === 'both',
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
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Back arrow */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} disabled={submitting}>
            <Ionicons name="arrow-back" size={24} color="#ff2c60" />
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
            placeholderTextColor="rgba(19,23,61,0.35)"
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
            placeholderTextColor="rgba(19,23,61,0.35)"
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
                I agree to the <Text style={s.checkLink}>TOS</Text>
              </Text>
            </Checkbox>
            <Checkbox checked={agreedPrivacy} onPress={() => setAgreedPrivacy(v => !v)}>
              <Text style={s.checkLabel}>
                I agree to the <Text style={s.checkLink}>Privacy Policy</Text>
              </Text>
            </Checkbox>
            <Checkbox checked={agreedMedical} onPress={() => setAgreedMedical(v => !v)}>
              <Text style={s.checkLabel}>I have a medical agreement</Text>
            </Checkbox>
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
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#13173d' },
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
  titleEcho: { color: '#c524e6', position: 'absolute', top: 5, left: 5 },
  titleFront: { color: '#ff2c60' },

  // Field labels
  fieldLabel: {
    alignSelf: 'flex-start',
    color: '#ff2c60',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
    marginBottom: 10,
  },

  // Input
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

  // Google
  googlePrompt: {
    color: '#a0a0c0',
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
    borderColor: '#ff2c60',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: { backgroundColor: '#ff2c60' },
  checkLabel: { color: '#ffffff', fontSize: 13, fontWeight: '500', flex: 1 },
  checkLink: { color: '#ff2c60', fontWeight: '700', textDecorationLine: 'underline' },

  btnDisabled: {
    opacity: 0.35,
  },

  // Done button
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
