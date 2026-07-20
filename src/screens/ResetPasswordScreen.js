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
import { resetPassword } from '../api/api';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeContext';

const ResetPasswordScreen = ({ navigation, route }) => {
  const { email, code } = route.params;
  const styles = useThemedStyles(makeStyles);
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 4) {
      Alert.alert('Weak Password', 'Password must have at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords Don't Match", 'Please make sure both passwords match.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, code, password);
      Alert.alert('Password Updated', 'You can now sign in with your new password.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
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
            <Text style={[styles.titleBase, styles.titleEcho]}>New Password</Text>
            <Text style={[styles.titleBase, styles.titleFront]}>New Password</Text>
          </View>

          <Text style={styles.fieldLabel}>NEW PASSWORD:</Text>
          <TextInput
            style={styles.input}
            placeholder="New password..."
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.fieldLabel, { marginTop: 22 }]}>CONFIRM PASSWORD:</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm password..."
            placeholderTextColor={Colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            activeOpacity={0.82}
            onPress={handleReset}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Reset Password</Text>
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
  titleWrapper: { paddingBottom: 6, paddingRight: 6, marginBottom: 28 },
  titleBase: { fontSize: 32, fontWeight: '900', fontStyle: 'italic', letterSpacing: 0.5 },
  titleEcho: { color: Colors.primaryDark, position: 'absolute', top: 4, left: 4 },
  titleFront: { color: Colors.primary },
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

export default ResetPasswordScreen;
