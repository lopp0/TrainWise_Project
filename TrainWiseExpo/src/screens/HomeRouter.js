import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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
 *  - both          → a swipeable pager (My Trainees ⇄ My Training) with a
 *                    synced segmented toggle on top (FR-31). The chosen page is
 *                    persisted so the user lands where they left off.
 */
const HomeRouter = (props) => {
  const { user } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const isCoach = !!user?.isCoach;
  const isTrainee = user?.isTrainee !== false; // default true for legacy users
  const isCoachOnly = isCoach && !isTrainee;

  const [mode, setMode] = useState(null); // 'coach' | 'personal'
  const [size, setSize] = useState({ w: 0, h: 0 });
  const scrollRef = useRef(null);
  const didInit = useRef(false);

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

  // Page 0 = coach (My Trainees), Page 1 = personal (My Training).
  const pageOf = (m) => (m === 'personal' ? 1 : 0);

  const switchMode = (next) => {
    setMode(next);
    AsyncStorage.setItem(MODE_KEY, next);
    if (size.w > 0) {
      scrollRef.current?.scrollTo({ x: pageOf(next) * size.w, animated: true });
    }
  };

  const onMomentumEnd = (e) => {
    if (size.w <= 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / size.w);
    const next = page === 1 ? 'personal' : 'coach';
    if (next !== mode) {
      setMode(next);
      AsyncStorage.setItem(MODE_KEY, next);
    }
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

      <View
        style={{ flex: 1 }}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (w !== size.w || h !== size.h) setSize({ w, h });
        }}
      >
        {size.h > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            onLayout={() => {
              // Land on the saved page once, after layout.
              if (!didInit.current && size.w > 0) {
                didInit.current = true;
                scrollRef.current?.scrollTo({
                  x: pageOf(mode) * size.w,
                  animated: false,
                });
              }
            }}
            scrollEventThrottle={16}
          >
            <View style={{ width: size.w, height: size.h }}>
              <CoachDashboardScreen {...props} />
            </View>
            <View style={{ width: size.w, height: size.h }}>
              <HomeScreen {...props} />
            </View>
          </ScrollView>
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
