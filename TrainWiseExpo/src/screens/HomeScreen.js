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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import { useMessages } from '../api/MessagesContext';
import { getActivityLogs } from '../api/api';
import apiClient from '../api/api';
import { resolveProfileImageUrl, getCoachesForTrainee } from '../services/api';
import DraggableChatBubble from '../components/DraggableChatBubble';
import { scheduleDailyReminder } from '../api/NotificationService';
import { getStructuredWorkouts } from '../api/HealthConnectService';
import { getWeekStartDate, getWeekDayLabels } from '../constants/weekStart';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { computeWeeklyStats, computeDailyStats } from '../utils/weeklyStats';
import { buildRestRecommendation } from '../utils/restRecommendation';
import { processCheckIn, getStreakEmoji } from '../utils/checkInManager';
import {
  getEquippedTitle,
  getEquippedChartTheme,
  findShopItem,
} from '../utils/shopManager';

const { width } = Dimensions.get('window');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Feature flag: when false, the coach chat is NOT a floating bubble on Home —
// instead the unread count appears as a badge on the "My coach" button (and on
// the Message button inside MyCoachScreen). Flip to true to bring back the
// draggable bubble directly on the home screen.
const SHOW_COACH_BUBBLE = false;

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
    // Only CONFIRMED workouts count toward the dashboard. Health-Connect
    // workouts sync in as isConfirmed=false (Pending) and must NOT inflate
    // the chart or weekly totals until the user confirms them on the Health
    // tab. Mirrors WarningsDashboardScreen's filter.
    if ((log.isConfirmed ?? log.IsConfirmed) === false) return;
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
/** Picks a bar color, optionally using a shop-theme palette. The theme
 *  override only applies to non-empty bars so the empty-bar treatment
 *  (faded card-background) stays consistent across themes. */
const resolveBarColor = (load, themeColors) => {
  if (load <= 0) return Colors.cardBackgroundLight;
  if (!themeColors) return getBarColor(load);
  if (load < 150) return themeColors.low;
  if (load < 300) return themeColors.medium;
  if (load < 500) return themeColors.high;
  return themeColors.veryHigh;
};

const WeeklyBarChart = ({ weeklyData, maxValue, onBarPress, selectedIndex, themeColors }) => {
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
                    backgroundColor: resolveBarColor(item.load, themeColors),
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: Colors.textPrimary,
                  },
                ]}
              />
            </View>
            <Text style={[chartStyles.dayLabel, { color: Colors.textSecondary }]}>{DAYS[item.dayIndex]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Layout-only — no themed colors here, so this can stay module-level.
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
    fontSize: 10,
    marginTop: 5,
  },
});

// ─────────────────────────────────────────────
// HomeScreen
// ─────────────────────────────────────────────
const HomeScreen = ({ navigation }) => {
  const { user, userId } = useAuth();
  const { unreadCount } = useMessages();
  const styles = useThemedStyles(makeStyles);
  const [backendLogs, setBackendLogs] = useState([]);
  const [hcWorkouts, setHcWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadWarnings, setUnreadWarnings] = useState(0);
  const [acRatio, setAcRatio] = useState(0);
  const [checkInState, setCheckInState] = useState({ streak: 0, coins: 0 });
  const [coinsEarnedToast, setCoinsEarnedToast] = useState(0);
  const [equippedTitleId, setEquippedTitleId] = useState(null);
  const [equippedChartThemeId, setEquippedChartThemeId] = useState(null);
  const [coach, setCoach] = useState(null); // first connected coach, if any
  const [coachBubbleDismissed, setCoachBubbleDismissed] = useState(false);

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
      // Quiet on network errors — Home re-fetches every focus, so a
      // single failed launch is not actionable.
      const isNetwork = /network|timeout|econn|fetch/i.test(e.message || '');
      if (!isNetwork) console.warn('[HomeScreen] Backend load failed:', e.message);
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

    let latestAcRatio = 0;
    try {
      const res = await apiClient.get(`/api/dailyload/user/${userId}`);
      const entries = Array.isArray(res.data) ? res.data : [];
      if (entries.length > 0) {
        const latest = entries.reduce((best, cur) => {
          const bd = new Date(best.date || best.Date || 0).getTime();
          const cd = new Date(cur.date || cur.Date || 0).getTime();
          return cd > bd ? cur : best;
        });
        latestAcRatio = Number(latest.acRatio ?? latest.ACRatio ?? 0) || 0;
      }
    } catch {
      latestAcRatio = 0;
    }
    setAcRatio(latestAcRatio);

    // Surface a "Message your coach" entry only if this trainee is linked to a
    // coach. Pick the first; the dedicated coach screen (#2) will list all.
    try {
      const res = await getCoachesForTrainee(userId);
      const coaches = Array.isArray(res.data) ? res.data : [];
      setCoach(coaches[0] || null);
    } catch {
      // no coach / endpoint unavailable — just hide the entry
    }

    // Re-schedule the daily reminder with fresh load-aware copy. The
    // function suppresses the push entirely when injury risk is high, so
    // we pass both the ratio and the derived level. Threshold mirrors
    // WarningsDashboardScreen.determineLoadLevel.
    const level =
      latestAcRatio > 1.3 ? 'Red' : latestAcRatio >= 0.8 ? 'Yellow' : 'Green';
    scheduleDailyReminder(latestAcRatio, level).catch(() => {});

    setLoading(false);
  }, [userId]);

  const runCheckIn = useCallback(async () => {
    try {
      const result = await processCheckIn();
      setCheckInState({ streak: result.streak, coins: result.coins });
      if (result.isNewCheckIn && result.coinsEarned > 0) {
        setCoinsEarnedToast(result.coinsEarned);
      }
    } catch (e) {
      console.warn('[HomeScreen] check-in failed:', e.message);
    }
  }, []);

  const loadEquippedCosmetics = useCallback(async () => {
    try {
      const [title, theme] = await Promise.all([
        getEquippedTitle(),
        getEquippedChartTheme(),
      ]);
      setEquippedTitleId(title);
      setEquippedChartThemeId(theme);
    } catch (e) {
      console.warn('[HomeScreen] cosmetics load failed:', e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      runCheckIn();
      loadEquippedCosmetics();
      loadData();
    }, [runCheckIn, loadEquippedCosmetics, loadData])
  );

  // Auto-dismiss the "+X coins!" celebration after 2 seconds.
  useEffect(() => {
    if (coinsEarnedToast > 0) {
      const t = setTimeout(() => setCoinsEarnedToast(0), 2000);
      return () => clearTimeout(t);
    }
  }, [coinsEarnedToast]);

  const weeklyData = buildWeeklyData(backendLogs, hcWorkouts);
  const maxLoad = Math.max(...weeklyData.map((d) => d.load), 100);
  const weeklyStats = computeWeeklyStats(weeklyData);
  const dailyStats = computeDailyStats(weeklyData);
  const recommendation = acRatio > 0 ? buildRestRecommendation({ acRatio }) : null;
  const equippedTitleItem = equippedTitleId ? findShopItem(equippedTitleId) : null;
  const equippedChartTheme = equippedChartThemeId
    ? findShopItem(equippedChartThemeId)
    : null;
  const chartThemeColors = equippedChartTheme?.colors || null;
  const greetingPrefix = equippedTitleItem?.titleText
    ? `Hello ${equippedTitleItem.titleText}\n`
    : 'Hello\n';

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

        {/* ── Header row: streak + coins on the left (flat, no container),
            settings gear on the right. Streak/coins are still tappable to
            open the Shop. */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.streakCoinsGroup}
            onPress={() => navigation.navigate('Shop')}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.streakItem}>
              <Ionicons name="flame" size={20} color="#ff7a00" />
              <Text style={styles.streakValue}>{checkInState.streak}</Text>
            </View>
            <View style={styles.coinsItem}>
              <Text style={styles.coinsEmoji}>💰</Text>
              <Text style={styles.coinsValue}>{checkInState.coins}</Text>
            </View>
            {coinsEarnedToast > 0 && (
              <Text style={styles.coinsToast}>+{coinsEarnedToast}</Text>
            )}
          </TouchableOpacity>
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
            {greetingPrefix}
            <Text style={styles.helloName}>{user?.fullName || 'Athlete'}!</Text>
          </Text>
          <View style={styles.avatarCircle}>
            {resolveProfileImageUrl(user?.profileImagePath) ? (
              <Image
                source={{ uri: resolveProfileImageUrl(user.profileImagePath) }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons name="person" size={48} color={Colors.textMuted} />
            )}
          </View>
        </View>

        {/* ── Load recommendation banner ── */}
        {recommendation && (
          <TouchableOpacity
            style={[styles.recBanner, { borderLeftColor: recommendation.color }]}
            onPress={() => navigation.navigate('Warnings')}
            activeOpacity={0.85}
          >
            <Ionicons
              name={recommendation.icon}
              size={26}
              color={recommendation.color}
              style={styles.recBannerIcon}
            />
            <View style={styles.recBannerTextWrap}>
              <Text style={[styles.recBannerTitle, { color: recommendation.color }]}>
                {recommendation.title}
              </Text>
              <Text style={styles.recBannerBody} numberOfLines={2}>
                {recommendation.shortText}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

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

          {/* My Network now holds coaches AND friends, so it's always shown
              (not gated on having a coach). The badge surfaces unread chat. */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cyanBtn]}
              onPress={() => navigation.navigate('InjuryReport')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{'Report\ninjury'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('MyNetwork', { selfId: userId })}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{'My\nnetwork'}</Text>
              {unreadCount > 0 && (!SHOW_COACH_BUBBLE || coachBubbleDismissed) && (
                <View style={styles.coachBtnBadge}>
                  <Text style={styles.coachBtnBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
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
                themeColors={chartThemeColors}
              />
            </View>
          )}
        </View>

        {/* ── Weekly + daily stats summary ── */}
        {!loading && weeklyStats.hasData && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>This week</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{weeklyStats.workoutCount}</Text>
                <Text style={styles.statLabel}>Workouts</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{weeklyStats.totalLoad}</Text>
                <Text style={styles.statLabel}>Total load</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{weeklyStats.avgLoad}</Text>
                <Text style={styles.statLabel}>Avg / session</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{weeklyStats.peakDay || '—'}</Text>
                <Text style={styles.statLabel}>
                  Peak day{weeklyStats.peakLoad ? ` (${weeklyStats.peakLoad})` : ''}
                </Text>
              </View>
            </View>

            <View style={styles.statsDivider} />

            <Text style={styles.statsTitle}>Today</Text>
            {dailyStats && dailyStats.hasWorkout ? (
              <View style={styles.todayRow}>
                <View
                  style={[styles.todayDot, { backgroundColor: dailyStats.status.color }]}
                />
                <Text style={styles.todayLoad}>{dailyStats.load}</Text>
                <Text style={[styles.todayStatus, { color: dailyStats.status.color }]}>
                  {dailyStats.status.label}
                </Text>
              </View>
            ) : (
              <Text style={styles.todayEmpty}>No workout today</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating AI assistant bubble — "sparkles" so it's clearly the AI
          assistant, not the coach chat. */}
      <TouchableOpacity
        style={styles.chatBubble}
        onPress={() => navigation.navigate('AIChat')}
        activeOpacity={0.85}
      >
        <Ionicons name="sparkles" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Draggable "message your coach" bubble (only if linked to a coach).
          Starts bottom-left so it doesn't sit on the AI chat bubble. */}
      {SHOW_COACH_BUBBLE && coach && !coachBubbleDismissed && (
        <DraggableChatBubble
          initialX={18}
          badge={unreadCount}
          imageUri={resolveProfileImageUrl(
            coach.profileImagePath ?? coach.ProfileImagePath
          )}
          onDismiss={() => setCoachBubbleDismissed(true)}
          onPress={() =>
            navigation.navigate('Chat', {
              selfId: userId,
              peerId: coach.coachUserID ?? coach.CoachUserID,
              peerName: coach.fullName ?? coach.FullName,
              peerImagePath: coach.profileImagePath ?? coach.ProfileImagePath,
            })
          }
        />
      )}
    </SafeAreaView>
  );
};

const BTN_W = (width - 52) / 2; // two buttons side-by-side with padding + gap

const makeStyles = (C) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 36,
  },

  // ── Header row: streak/coins (flat, left) + gear (right)
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  streakCoinsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  streakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakValue: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  coinsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinsEmoji: {
    fontSize: 16,
  },
  coinsValue: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '900',
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
    color: C.primary,
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
    backgroundColor: C.cardBackground,
    borderWidth: 2,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },

  coinsToast: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
  },

  // ── Subtitle
  subtitle: {
    color: C.textSecondary,
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
    backgroundColor: C.cardBackground,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    borderWidth: 1,
    borderColor: C.border,
  },
  cyanBtn: {
    backgroundColor: C.primaryLight,
    borderColor: C.primary,
  },
  coachBtnBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: C.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.background,
  },
  coachBtnBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  actionBtnText: {
    color: C.primary,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Chart
  chartCard: {
    backgroundColor: C.cardBackground,
    borderRadius: 14,
    padding: 16,
    paddingBottom: 12,
    minHeight: 160,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
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
    color: C.textMuted,
    fontSize: 11,
  },
  noDataText: {
    color: C.textMuted,
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 30,
  },

  // ── Recommendation banner (load-based, taps through to Warnings)
  recBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBackground,
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  recBannerIcon: {
    marginRight: 12,
  },
  recBannerTextWrap: {
    flex: 1,
  },
  recBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  recBannerBody: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },

  // ── Stats summary card (below chart)
  statsCard: {
    backgroundColor: C.cardBackground,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  statsTitle: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    backgroundColor: C.background,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  statValue: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: C.textSecondary,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  statsDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  todayLoad: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginRight: 10,
  },
  todayStatus: {
    fontSize: 14,
    fontWeight: '700',
  },
  todayEmpty: {
    color: C.textSecondary,
    fontSize: 13,
  },

  // ── Warning banner
  warningBanner: {
    backgroundColor: C.primaryDark,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  warningBannerTitle: {
    color: C.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  warningBannerSubtitle: {
    color: C.textPrimary,
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Floating AI chat bubble
  chatBubble: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});

export default HomeScreen;
