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
import { requestPasswordReset } from '../api/api';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeContext';

const ForgotPasswordScreen = ({ navigation }) => {
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      navigation.navigate('VerifyResetCode', { email: email.trim() });
    } catch (err) {
      Alert.alert('Something went wrong', err.message || 'Please try again.');
    } finally {
      setLoading(false);
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
            <Text style={[styles.titleBase, styles.titleEcho]}>Reset Password</Text>
            <Text style={[styles.titleBase, styles.titleFront]}>Reset Password</Text>
          </View>

          <Text style={styles.subtitle}>
            Enter the email on your account and we&apos;ll send you a code to reset your password.
          </Text>

          <Text style={styles.fieldLabel}>YOUR EMAIL:</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Email here..."
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            activeOpacity={0.82}
            onPress={handleSend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Send Code</Text>
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
});

export default ForgotPasswordScreen;
