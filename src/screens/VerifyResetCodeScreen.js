import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { requestPasswordReset, verifyResetCode } from '../api/api';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeContext';

const VerifyResetCodeScreen = ({ navigation, route }) => {
  const { email } = route.params;
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Enter the 6-digit code we emailed you.');
      return;
    }
    setLoading(true);
    try {
      await verifyResetCode(email, code.trim());
      navigation.navigate('ResetPassword', { email, code: code.trim() });
    } catch (err) {
      Alert.alert('Verification Failed', err.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await requestPasswordReset(email);
      Alert.alert('Code Sent', 'A new code has been sent to your email.');
    } catch (err) {
      Alert.alert('Something went wrong', err.message || 'Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>

          <View style={styles.titleWrapper}>
            <Text style={[styles.titleBase, styles.titleEcho]}>Enter Code</Text>
            <Text style={[styles.titleBase, styles.titleFront]}>Enter Code</Text>
          </View>

          <Text style={styles.subtitle}>
            We sent a 6-digit code to {email}. It expires in 10 minutes.
          </Text>

          <Text style={styles.fieldLabel}>RESET CODE:</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="000000"
            placeholderTextColor={Colors.textMuted}
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            activeOpacity={0.82}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Verify</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendRow} activeOpacity={0.75} onPress={handleResend} disabled={resending}>
            {resending ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.resendText}>Didn&apos;t get it? RESEND CODE</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingVertical: 24 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8, padding: 4 },
  titleWrapper: { paddingBottom: 6, paddingRight: 6, marginBottom: 16 },
  titleBase: { fontSize: 32, fontWeight: '900', fontStyle: 'italic', letterSpacing: 0.5 },
  titleEcho: { color: Colors.primaryDark, position: 'absolute', top: 4, left: 4 },
  titleFront: { color: Colors.primary },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 28,
  },
  fieldLabel: {
    alignSelf: 'flex-start',
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
    marginBottom: 8,
  },
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
  codeInput: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 28,
    width: '100%',
    backgroundColor: Colors.primary,
    borderWidth: 6,
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
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#ffffff', fontSize: 20, fontWeight: '800', fontStyle: 'italic' },
  resendRow: { marginTop: 20, alignItems: 'center', minHeight: 24, justifyContent: 'center' },
  resendText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textDecorationLine: 'underline',
  },
});

export default VerifyResetCodeScreen;
