import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../api/AuthContext';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <Image
              source={require('../../assets/images/wowowow.png')}
              style={styles.titleIcon}
              resizeMode="contain"
            />
            <View style={styles.titleWrapper}>
              <Text style={[styles.titleBase, styles.titleEcho]} numberOfLines={1}>
                Sign in
              </Text>
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

          <Text style={styles.fieldLabel}>YOUR EMAIL:</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Email here..."
            placeholderTextColor="#a0a0a0"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.fieldLabel, { marginTop: 22 }]}>YOUR PASSWORD:</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password here..."
            placeholderTextColor="#a0a0a0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

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

          <View style={styles.resetRow}>
            <Text style={styles.resetPrompt}>{"CAN'T LOG IN?\nRESET PASSWORD "}</Text>
            <TouchableOpacity activeOpacity={0.75}>
              <Text style={styles.resetHere}>HERE!</Text>
            </TouchableOpacity>
          </View>

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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#13173d',
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
  titleBase: {
    fontSize: 46,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  titleEcho: {
    color: '#c524e6',
    position: 'absolute',
    top: 6,
    left: 6,
  },
  titleFront: {
    color: '#ff2c60',
  },
  fieldLabel: {
    alignSelf: 'flex-start',
    color: '#ff2c60',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
    marginBottom: 8,
  },
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
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    fontStyle: 'italic',
  },
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
