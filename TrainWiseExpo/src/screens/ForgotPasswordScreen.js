import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { forgotPassword, resetPassword } from '../services/api';
import PasswordInput from '../components/PasswordInput';
import PasswordRequirements from '../components/PasswordRequirements';
import { isValidPassword } from '../utils/validation';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #110 — Forgot / reset password. Three steps: email → emailed code → new
 * password. The backend never reveals whether the email exists (same message
 * either way). Without an email provider wired, the API returns the code in dev
 * mode (AUTH_DEV_CODES=true) which we prefill so the flow is demonstrable.
 */
const ForgotPasswordScreen = ({ navigation }) => {
  const styles = useThemedStyles(makeStyles);
  const [step, setStep] = useState(1); // 1 email · 2 code+new password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [devHint, setDevHint] = useState(null);

  const requestCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Enter your email', 'Please enter the email on your account.');
      return;
    }
    setBusy(true);
    try {
      const res = await forgotPassword(email.trim());
      // Dev fallback: the API returns the code when no email provider is wired.
      const devCode = res.data?.devCode;
      if (devCode) { setCode(String(devCode)); setDevHint(String(devCode)); }
      setStep(2);
    } catch {
      // Same generic outcome regardless (don't reveal existence).
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (!code.trim()) { Alert.alert('Enter the code', 'Enter the 6-digit code you received.'); return; }
    if (!isValidPassword(newPassword)) {
      Alert.alert('Weak password', 'Your password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.');
      return;
    }
    if (newPassword !== confirm) { Alert.alert('Passwords do not match', 'Re-enter the same password.'); return; }
    setBusy(true);
    try {
      await resetPassword(email.trim(), code.trim(), newPassword);
      Alert.alert('Password reset', 'You can now log in with your new password.', [
        { text: 'Log in', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e) {
      Alert.alert('Could not reset', e?.response?.data?.toString?.() || 'The code may be wrong or expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Reset password</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step === 1 ? (
            <>
              <Text style={styles.lead}>Enter your account email and we'll send you a reset code.</Text>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
              <TouchableOpacity style={styles.btn} onPress={requestCode} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send reset code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.lead}>
                If an account exists for {email.trim()}, a 6-digit code was sent. Enter it and choose a new password.
              </Text>
              {devHint ? <Text style={styles.devHint}>Dev mode code: {devHint}</Text> : null}

              <Text style={styles.label}>Reset code</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={styles.label}>New password</Text>
              <PasswordInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor={Colors.textMuted}
              />
              <PasswordRequirements password={newPassword} />

              <Text style={styles.label}>Confirm new password</Text>
              <PasswordInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter new password"
                placeholderTextColor={Colors.textMuted}
              />

              <TouchableOpacity style={styles.btn} onPress={doReset} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset password</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={requestCode} disabled={busy}>
                <Text style={styles.linkText}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8,
  },
  title: { color: C.primary, fontSize: 22, fontWeight: '900', fontStyle: 'italic' },
  body: { padding: 20 },
  lead: { color: C.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  devHint: {
    color: C.warning, fontSize: 13, fontWeight: '800', marginBottom: 4,
    backgroundColor: C.warning + '18', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, overflow: 'hidden',
  },
  label: { color: C.textSecondary, fontSize: 12, fontWeight: '800', marginTop: 16, marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: C.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: C.textPrimary, fontSize: 16, borderWidth: 1, borderColor: C.inputBorder,
  },
  btn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  linkBtn: { alignItems: 'center', paddingVertical: 14 },
  linkText: { color: C.primary, fontSize: 14, fontWeight: '700' },
});

export default ForgotPasswordScreen;
