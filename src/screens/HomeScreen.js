import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import { getActivityLogs } from '../api/api';
import apiClient from '../api/api';
import { getStructuredWorkouts } from '../api/HealthConnectService';
import { getWeekStartDate, getWeekDayLabels } from '../constants/weekStart';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Returns a hex color based on the workout load value (session load units).
 *  Empty bars take Colors.cardBackgroundLight so they fade into the card on
 *  both themes; the load colors are intentionally fixed (red/yellow/green
 *  carry meaning that should not change with theme). */
export const getBarColor = (load) => {
  if (load <= 0) return Colors.cardBackgroundLight;
  if (load < 150) return '#00e676';
  if (load < 300) return '#ffee58';
  if (load < 500) return '#ff9800';
  return '#f44336';
};

/** Returns the start of the current week at midnight, honoring user setting. */
const getWeekStart = () => getWeekStartDate(0);

/**
 * Builds a 7-element array (Sun–Sat) of { dayIndex, load, source, log, hcWorkout }.
 * Prefers backend (confirmed) load; falls back to Health Connect estimated load.
 */
export const buildWeeklyData = (backendLogs, hcWorkouts) => {
  const weekStart = getWeekStart();

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return {
      date: d,
      // dayIndex stores the JS day-of-week (Sun=0..Sat=6) so DAYS[dayIndex]
      // labels stay correct regardless of the configured week start.
      dayIndex: d.getDay(),
      load: 0,
      source: 'none',
      log: null,
      hcWorkout: null,
    };
  });

  // Build a lookup map: dateString → index in weekDays
  const dateToIndex = {};
  weekDays.forEach((wd, i) => {
    dateToIndex[wd.date.toDateString()] = i;
  });

  // Source 1 – backend confirmed logs. Sum all sessions on the same day.
  (backendLogs || []).forEach((log) => {
    const key = new Date(log.startTime || log.StartTime).toDateString();
    const idx = dateToIndex[key];
    if (idx === undefined) return;
    const sessionLoad = Number(
      log.calculatedLoadForSession ??
        log.CalculatedLoadForSession ??
        Math.round(((log.duration || 0) * (log.exertionLevel || 5)) / 10)
    );
    weekDays[idx].load += sessionLoad;
    weekDays[idx].source = 'backend';
    weekDays[idx].log = log;
  });

  // Only confirmed backend logs count toward the dashboard load. Health Connect
  // data is no longer auto-displayed — a deleted log must stay empty.

  weekDays.forEach((d) => {
    d.load = Math.round(d.load);
  });

  return weekDays;
};

// ─────────────────────────────────────────────
// Reusable bar-chart component (per-bar colors)
// ─────────────────────────────────────────────
const WeeklyBarChart = ({ weeklyData, maxValue, onBarPress, selectedIndex }) => {
  const CHART_H = 110;
  return (
    <View style={chartStyles.root}>
      {weeklyData.map((item, i) => {
        const barH =
          item.load > 0
            ? Math.max(6, (item.load / maxValue) * CHART_H)
            : 6;
        const isSelected = selectedIndex === i;
        return (
          <TouchableOpacity
            key={i}
            style={chartStyles.col}
            onPress={() => onBarPress?.(i)}
            activeOpacity={0.75}
          >
            <View style={[chartStyles.barWrapper, { height: CHART_H }]}>
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: barH,
                    backgroundColor: getBarColor(item.load),
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: Colors.textPrimary,
                  },
                ]}
              />
            </View>
            <Text style={chartStyles.dayLabel}>{DAYS[item.dayIndex]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const chartStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 30,
    borderRadius: 5,
  },
  dayLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 5,
  },
});

// ─────────────────────────────────────────────
// HomeScreen
// ─────────────────────────────────────────────
const HomeScreen = ({ navigation }) => {
  const { user, userId } = useAuth();
  const [backendLogs, setBackendLogs] = useState([]);
  const [hcWorkouts, setHcWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadWarnings, setUnreadWarnings] = useState(0);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const logs = await getActivityLogs(userId);
      setBackendLogs(logs || []);
    } catch (e) {
      console.warn('[HomeScreen] Backend load failed:', e.message);
    }

    try {
      const weekStart = getWeekStart();
      const hcData = await getStructuredWorkouts(weekStart, new Date());
      setHcWorkouts(hcData || []);
    } catch (e) {
      console.warn('[HomeScreen] Health Connect unavailable:', e.message);
    }

    try {
      const res = await apiClient.get(`/api/CoachRecommendations/user/${userId}/unread-count`);
      setUnreadWarnings(res.data ?? 0);
    } catch {
      try {
        const res = await apiClient.get(`/api/CoachRecommendations/user/${userId}`);
        const count = (res.data || []).filter((w) => w.isRead === false).length;
        setUnreadWarnings(count);
      } catch {
        // endpoint not ready — silently ignore
      }
    }

    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const weeklyData = buildWeeklyData(backendLogs, hcWorkouts);
  const maxLoad = Math.max(...weeklyData.map((d) => d.load), 100);

  const handleBarPress = (dayIndex) => {
    navigation.navigate('Stats', { selectedDayIndex: dayIndex });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Unread warnings banner ── */}
        {unreadWarnings > 0 && (
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={() => navigation.navigate('Warnings')}
          >
            <Text style={styles.warningBannerTitle}>
              You have {unreadWarnings} unread warnings
            </Text>
            <Text style={styles.warningBannerSubtitle}>
              Click here to view
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Gear icon row ── */}
        <View style={styles.gearRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="settings-outline" size={26} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Top row: greeting + avatar ── */}
        <View style={styles.topRow}>
          <Text style={styles.helloText}>
            {'Hello\n'}
            <Text style={styles.helloName}>{user?.fullName || 'Athlete'}!</Text>
          </Text>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={48} color={Colors.textMuted} />
          </View>
        </View>

        {/* ── Subtitle ── */}
        <Text style={styles.subtitle}>WHAT WOULD YOU LIKE TO DO TODAY?</Text>

        {/* ── Action buttons ── */}
        <View style={styles.buttonsWrap}>
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('AddWorkout')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{'Add a\nworkout'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('Warnings')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{'See\nwarnings'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.btnRowCenter}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cyanBtn]}
              onPress={() => navigation.navigate('InjuryReport')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{'Report\ninjury'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Weekly chart ── */}
        <View style={styles.chartCard}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 40 }} />
          ) : weeklyData.every((d) => d.load === 0) ? (
            <Text style={styles.noDataText}>No workouts this week</Text>
          ) : (
            <View style={styles.chartRow}>
              {/* Y-axis labels */}
              <View style={styles.yAxis}>
                <Text style={styles.yLabel}>{maxLoad}</Text>
                <Text style={styles.yLabel}>0</Text>
              </View>
              {/* Bars */}
              <WeeklyBarChart
                weeklyData={weeklyData}
                maxValue={maxLoad}
                onBarPress={handleBarPress}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const BTN_W = (width - 52) / 2; // two buttons side-by-side with padding + gap

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  scroll: {
    padding: 16,
    paddingBottom: 36,
  },

  // ── Gear row
  gearRow: {
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
  },

  // ── Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  helloText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ff2d6f',
    fontStyle: 'italic',
    lineHeight: 40,
    flex: 1,
  },
  helloName: {
    fontSize: 36,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#0d1117',
    borderWidth: 2,
    borderColor: '#2d333b',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  // ── Subtitle
  subtitle: {
    color: '#00e5cc',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginBottom: 22,
    letterSpacing: 0.4,
  },

  // ── Buttons
  buttonsWrap: {
    marginBottom: 24,
    gap: 14,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 14,
  },
  btnRowCenter: {
    alignItems: 'center',
  },
  actionBtn: {
    width: BTN_W,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  cyanBtn: {
    backgroundColor: '#00e5cc',
  },
  actionBtnText: {
    color: '#ff2d6f',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Chart
  chartCard: {
    backgroundColor: '#161b22',
    borderRadius: 14,
    padding: 16,
    paddingBottom: 12,
    minHeight: 160,
    justifyContent: 'center',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  yAxis: {
    width: 30,
    justifyContent: 'space-between',
    paddingBottom: 22,
    paddingTop: 4,
  },
  yLabel: {
    color: '#666',
    fontSize: 11,
  },
  noDataText: {
    color: '#555',
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 30,
  },

  // ── Warning banner
  warningBanner: {
    backgroundColor: '#c2185b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  warningBannerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  warningBannerSubtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default HomeScreen;
