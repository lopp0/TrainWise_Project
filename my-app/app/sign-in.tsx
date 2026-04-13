import React, { useState, useEffect } from 'react';
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
import { AntDesign } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_WEB_CLIENT_ID } from '@/constants/google';

// Required: lets Expo close the browser tab after OAuth redirect
WebBrowser.maybeCompleteAuthSession();

// ── SignInScreen ──────────────────────────────────────────────────────────────
export default function SignInScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Google OAuth hook ──
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    // If you later create an Android-specific credential, add it here:
    // androidClientId: 'YOUR_ANDROID_CLIENT_ID',
  });

  // ── Handle the OAuth response ──
  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) {
        fetchGoogleUser(token);
      }
    } else if (response?.type === 'error') {
      setGoogleLoading(false);
      Alert.alert('Google Sign-In failed', response.error?.message ?? 'Unknown error');
    } else if (response?.type === 'dismiss') {
      setGoogleLoading(false);
    }
  }, [response]);

  // ── Fetch the signed-in user's Google profile ──
  async function fetchGoogleUser(accessToken: string) {
    try {
      const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const user = await res.json();
      // TODO: pass user.email / user.name to your BL auth layer
      console.log('Google user:', user);
      Alert.alert('Signed in!', `Welcome, ${user.name ?? user.email}`);
    } catch {
      Alert.alert('Error', 'Could not retrieve Google profile.');
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleGooglePress() {
    setGoogleLoading(true);
    promptAsync();
  }

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
          {/* ── Title row: logo | Sign in | logo ── */}
          <View style={styles.titleRow}>
            <Image
              source={require('@/assets/images/wowowow.png')}
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
              source={require('@/assets/images/wowowow.png')}
              style={styles.titleIcon}
              resizeMode="contain"
            />
          </View>

          {/* ── Email field ── */}
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

          {/* ── Password field ── */}
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

          {/* ── Sign In button ── */}
          <TouchableOpacity style={styles.signInButton} activeOpacity={0.82}>
            <Text style={styles.signInButtonText}>Sign in</Text>
          </TouchableOpacity>

          {/* ── Reset password hint ── */}
          <View style={styles.resetRow}>
            <Text style={styles.resetPrompt}>{"CAN'T LOG IN?\nRESET PASSWORD "}</Text>
            <TouchableOpacity activeOpacity={0.75}>
              <Text style={styles.resetHere}>HERE!</Text>
            </TouchableOpacity>
          </View>

          {/* ── Google Sign-In button ── */}
          <TouchableOpacity
            style={[styles.googleButton, !request && styles.googleButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleGooglePress}
            disabled={!request || googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#EA4335" />
            ) : (
              <AntDesign name="google" size={22} color="#EA4335" />
            )}
            <Text style={styles.googleText}>Sign in with Google</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
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

  // ── Title ──
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

  // ── Form ──
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

  // ── Sign-In button ──
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
  signInButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    fontStyle: 'italic',
  },

  // ── Reset password ──
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

  // ── Google button ──
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
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleText: {
    color: '#3c3c3c',
    fontSize: 15,
    fontWeight: '600',
  },
});
