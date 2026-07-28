import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../api/AuthContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import HomeScreen from './HomeScreen';
import CoachDashboardScreen from './CoachDashboardScreen';

const MODE_KEY = '@trainwise_home_mode';

/**
 * The `HomeMain` route.
 *  - trainee-only  → HomeScreen
 *  - coach-only    → CoachDashboardScreen
 *  - both          → a TAP-switched segmented toggle (My Trainees ⇄ My Training).
 *                    The chosen page is persisted so the user lands where they
 *                    left off.
 *
 * #9 (2026-07-19): this used to be a horizontal `pagingEnabled` swipe pager, but
 * that OUTER horizontal swipe stole every INNER horizontal glide on the pages
 * inside it (the workout-type selector, the injury-type selector, chip rows).
 * Switching to a tap-only toggle + conditional render removes the gesture
 * collision entirely — same fix already applied to AddWorkout's tabs (item 13).
 */
const HomeRouter = (props) => {
  const { user } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const isCoach = !!user?.isCoach;
  const isTrainee = user?.isTrainee !== false; // default true for legacy users
  const isCoachOnly = isCoach && !isTrainee;

  const [mode, setMode] = useState(null); // 'coach' | 'personal'

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await AsyncStorage.getItem(MODE_KEY);
      if (!active) return;
      setMode(saved === 'personal' ? 'personal' : 'coach');
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!isCoach) {
    return <HomeScreen {...props} />;
  }
  if (isCoachOnly) {
    return <CoachDashboardScreen {...props} />;
  }
  if (mode === null) {
    // Brief, avoids a flash of the wrong view before AsyncStorage resolves.
    return <SafeAreaView style={styles.safe} edges={['top']} />;
  }

  const switchMode = (next) => {
    setMode(next);
    AsyncStorage.setItem(MODE_KEY, next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'coach' && styles.toggleBtnActive]}
          onPress={() => switchMode('coach')}
          activeOpacity={0.85}
        >
          <Text style={[styles.toggleText, mode === 'coach' && styles.toggleTextActive]}>
            My Trainees
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'personal' && styles.toggleBtnActive]}
          onPress={() => switchMode('personal')}
          activeOpacity={0.85}
        >
          <Text style={[styles.toggleText, mode === 'personal' && styles.toggleTextActive]}>
            My Training
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conditional render (not a swipe pager) so inner horizontal glides work. */}
      <View style={{ flex: 1 }}>
        {mode === 'personal' ? (
          <HomeScreen {...props} />
        ) : (
          <CoachDashboardScreen {...props} />
        )}
      </View>
    </SafeAreaView>
  );
};

const makeStyles = (C) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    toggleRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      backgroundColor: C.cardBackground,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: C.border,
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: 9,
      alignItems: 'center',
      borderRadius: 9,
    },
    toggleBtnActive: { backgroundColor: C.primary },
    toggleText: { color: C.textSecondary, fontSize: 14, fontWeight: '700' },
    toggleTextActive: { color: C.textPrimary },
  });

export default HomeRouter;
