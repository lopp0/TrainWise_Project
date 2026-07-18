import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useAuth } from '../api/AuthContext';
import { authenticateBiometric } from '../utils/biometric';

/**
 * #112 — full-screen lock shown over the app when a biometric-enabled session
 * is restored. Auto-prompts on mount (and when returning to the foreground);
 * on success it unlocks, on failure the user can retry or fall back to password
 * (which logs out → Login).
 */
const BiometricLockOverlay = () => {
  const styles = useThemedStyles(makeStyles);
  const Colors = styles._colors;
  const { locked, unlock, logout } = useAuth();
  const [prompting, setPrompting] = useState(false);

  const tryUnlock = useCallback(async () => {
    if (prompting) return;
    setPrompting(true);
    const ok = await authenticateBiometric('Unlock TrainWise');
    setPrompting(false);
    if (ok) unlock();
  }, [prompting, unlock]);

  // Auto-prompt when the lock first appears.
  useEffect(() => {
    if (locked) tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  // Re-prompt when the user brings the app back to the foreground.
  useEffect(() => {
    if (!locked) return undefined;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tryUnlock();
    });
    return () => sub.remove();
  }, [locked, tryUnlock]);

  if (!locked) return null;

  return (
    <View style={styles.overlay}>
      <Ionicons name="finger-print" size={72} color={Colors.primary} />
      <Text style={styles.title}>TrainWise is locked</Text>
      <Text style={styles.subtitle}>Unlock with your fingerprint or face.</Text>

      <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={tryUnlock}>
        <Ionicons name="lock-open" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Unlock</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.7} onPress={logout}>
        <Text style={styles.secondaryBtnText}>Use password instead</Text>
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: Colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      zIndex: 9999,
    },
    title: {
      color: Colors.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      marginTop: 20,
    },
    subtitle: {
      color: Colors.textSecondary,
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: Colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 12,
      marginTop: 32,
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    secondaryBtn: { marginTop: 18, paddingVertical: 8 },
    secondaryBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  });
  s._colors = Colors;
  return s;
};

export default BiometricLockOverlay;
