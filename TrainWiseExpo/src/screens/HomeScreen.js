import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Image,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import { useMessages } from '../api/MessagesContext';
import { getActivityLogs } from '../api/api';
import apiClient from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  resolveProfileImageUrl,
  getCoachesForTrainee,
  getAllActivityTypes,
  getAllInjuryTypes,
  getActiveInjuriesByUser,
  getCalendar,
} from '../services/api';
import DraggableChatBubble from '../components/DraggableChatBubble';
import HomeHeader from '../components/HomeHeader';
import WeeklySummaryCard from '../components/WeeklySummaryCard';
import SmartSuggestionCard from '../components/SmartSuggestionCard';
import ActivityIcon from '../components/ActivityIcon';
import InjuryIcon from '../components/InjuryIcon';
import { scheduleDailyReminder } from '../api/NotificationService';
import { getStructuredWorkouts } from '../api/HealthConnectService';
import { getWeekStartDate, getWeekDayLabels } from '../constants/weekStart';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { buildRestRecommendation } from '../utils/restRecommendation';
import { processCheckIn, getStreakEmoji } from '../utils/checkInManager';
import {
  getEquippedTitle,
  getEquippedChartTheme,
  findShopItem,
} from '../utils/shopManager';
import OnboardingOverlay from '../components/OnboardingOverlay';
import { isOnboardingDone, markOnboardingDone } from '../utils/onboardingManager';

const { width } = Dimensions.get('window');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Feature flag: when false, the coach chat is NOT a floating bubble on Home —
// instead the unread count appears as a badge on the "My network" button (now
// in HomeHeader). Flip to true to bring back the draggable bubble directly on
// the home screen.
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

/** Severity (1-10) → traffic-light dot color. Semantic, fixed across themes. */
const severityColor = (sev) => {
  const s = Number(sev) || 0;
  if (s <= 3) return '#00e676';
  if (s <= 6) return '#ffee58';
  if (s <= 8) return '#ff9800';
  return '#f44336';
};

// ─────────────────────────────────────────────
// HomeScreen
// ─────────────────────────────────────────────
const HomeScreen = ({ navigation }) => {
  const { user, userId } = useAuth();
  const { unreadCount } = useMessages();
  const styles = useThemedStyles(makeStyles);
  // Tapping the Home tab again scrolls this list back to the top (item 1).
  const scrollRef = useRef(null);
  useScrollToTop(scrollRef);
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
  const [showOnboarding, setShowOnboarding] = useState(false);

  // B-2 — Add-Workout / Add-Injury sections. Each section always shows a compact
  // horizontal row by default ("folded"); the chevron EXPANDS it into a full
  // grid of every type (Runna-style). Add Injury is open (row visible) by default.
  const [activityTypes, setActivityTypes] = useState([]);
  const [injuryTypes, setInjuryTypes] = useState([]);
  const [activeInjuries, setActiveInjuries] = useState([]);
  const [workoutExpanded, setWorkoutExpanded] = useState(false); // false = row, true = grid
  const [injuryExpanded, setInjuryExpanded] = useState(false);   // false = row, true = grid
  const [coachPlanBadge, setCoachPlanBadge] = useState(0); // new coach-planned workouts (item 11)

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

    // Foldable Add-Workout / Add-Injury data (B-2). All best-effort: a failure
    // just leaves the section's row empty.
    try {
      const [actRes, injRes, activeRes] = await Promise.all([
        getAllActivityTypes(),
        getAllInjuryTypes(),
        getActiveInjuriesByUser(userId),
      ]);
      setActivityTypes(actRes.data || []);
      setInjuryTypes(injRes.data || []);
      setActiveInjuries(activeRes.data || []);
    } catch {
      // reference data / injuries unavailable — sections render empty
    }

    // Badge on the calendar icon when a coach has planned new workouts (item 11).
    try {
      const pad = (n) => String(n).padStart(2, '0');
      const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const todayD = new Date();
      const toD = new Date();
      toD.setDate(todayD.getDate() + 28);
      const calRes = await getCalendar(userId, ymd(todayD), ymd(toD));
      const plans = Array.isArray(calRes.data) ? calRes.data : [];
      const coachPlans = plans.filter((p) => p.createdByCoach ?? p.CreatedByCoach);
      const seenRaw = await AsyncStorage.getItem(`@trainwise_seen_coach_plans_${userId}`);
      const seen = new Set(seenRaw ? JSON.parse(seenRaw) : []);
      setCoachPlanBadge(coachPlans.filter((p) => !seen.has(p.planId ?? p.PlanId)).length);
    } catch {
      setCoachPlanBadge(0);
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

  // First-launch tutorial: show the overlay until the user finishes/skips it
  // (or replays it from Settings -> Reset Tutorial).
  const checkOnboarding = useCallback(async () => {
    try {
      const done = await isOnboardingDone();
      if (!done) setShowOnboarding(true);
    } catch (e) {
      console.warn('[HomeScreen] onboarding check failed:', e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      runCheckIn();
      checkOnboarding();
      loadEquippedCosmetics();
      loadData();
    }, [runCheckIn, checkOnboarding, loadEquippedCosmetics, loadData])
  );

  const handleOnboardingFinish = async () => {
    await markOnboardingDone();
    setShowOnboarding(false);
  };

  // Auto-dismiss the "+X coins!" celebration after 2 seconds.
  useEffect(() => {
    if (coinsEarnedToast > 0) {
      const t = setTimeout(() => setCoinsEarnedToast(0), 2000);
      return () => clearTimeout(t);
    }
  }, [coinsEarnedToast]);

  const weeklyData = buildWeeklyData(backendLogs, hcWorkouts);
  const maxLoad = Math.max(...weeklyData.map((d) => d.load), 100);
  const recommendation = acRatio > 0 ? buildRestRecommendation({ acRatio }) : null;
  const equippedTitleItem = equippedTitleId ? findShopItem(equippedTitleId) : null;
  const equippedChartTheme = equippedChartThemeId
    ? findShopItem(equippedChartThemeId)
    : null;
  const chartThemeColors = equippedChartTheme?.colors || null;

  const injuryNameById = (id) =>
    injuryTypes.find((i) => i.injuryTypeID === id)?.injuryName || `Injury #${id}`;

  const handleBarPress = (dayIndex) => {
    navigation.navigate('Stats', { selectedDayIndex: dayIndex });
  };

  const toggleSection = (setter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter((o) => !o);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── B-1: persistent profile header (avatar/streak/coins · network/settings) ── */}
      <HomeHeader
        navigation={navigation}
        selfId={userId}
        profileImagePath={user?.profileImagePath}
        fullName={user?.fullName}
        streak={checkInState.streak}
        coins={checkInState.coins}
        coinsToast={coinsEarnedToast}
        unreadCount={unreadCount}
        calendarBadge={coachPlanBadge}
      />

      <ScrollView
        ref={scrollRef}
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

        {/* ── Greeting ── */}
        <View style={styles.greetingWrap}>
          <Text style={styles.greeting}>Hi, {user?.fullName || 'Athlete'}!</Text>
          {equippedTitleItem?.titleText ? (
            <Text style={styles.greetingTitle}>{equippedTitleItem.titleText}</Text>
          ) : null}
        </View>

        {/* ── Active injuries (relocated up top, only when present) ── */}
        {activeInjuries.length > 0 && (
          <TouchableOpacity
            style={styles.activeInjuryCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ActiveInjuries')}
          >
            <MaterialCommunityIcons name="bandage" size={18} color={Colors.danger} />
            <Text style={styles.activeInjuryText} numberOfLines={1}>
              {activeInjuries.length === 1
                ? `Active injury: ${injuryNameById(activeInjuries[0].injuryTypeID)}`
                : `${activeInjuries.length} active injuries`}
            </Text>
            <View
              style={[
                styles.sevDot,
                { backgroundColor: severityColor(Math.max(...activeInjuries.map((i) => Number(i.severity) || 0))) },
              ]}
            />
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* ── Add Workout (compact row by default, chevron expands to full grid) ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            activeOpacity={0.8}
            onPress={() => toggleSection(setWorkoutExpanded)}
          >
            <View style={styles.sectionHeaderLeft}>
              <MaterialCommunityIcons name="dumbbell" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Add Workout</Text>
            </View>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.expandHint}>{workoutExpanded ? 'Less' : 'All'}</Text>
              <Ionicons
                name={workoutExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.primary}
              />
            </View>
          </TouchableOpacity>

          {activityTypes.length === 0 ? (
            <Text style={styles.sectionEmpty}>Loading activities…</Text>
          ) : workoutExpanded ? (
            <View style={styles.cardGrid}>
              {activityTypes.map((t) => (
                <TouchableOpacity
                  key={t.activityTypeID}
                  style={styles.gridCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate('AddWorkout', {
                      preselectActivityTypeId: t.activityTypeID,
                      liveTab: true,
                    })
                  }
                >
                  <ActivityIcon activityTypeId={t.activityTypeID} typeName={t.typeName} size={26} />
                  <Text style={styles.gridCardLabel} numberOfLines={1}>
                    {t.typeName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardRow}
            >
              {activityTypes.map((t) => (
                <TouchableOpacity
                  key={t.activityTypeID}
                  style={styles.typeCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate('AddWorkout', {
                      preselectActivityTypeId: t.activityTypeID,
                      liveTab: true,
                    })
                  }
                >
                  <ActivityIcon activityTypeId={t.activityTypeID} typeName={t.typeName} size={28} />
                  <Text style={styles.typeCardLabel} numberOfLines={2}>
                    {t.typeName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Smart suggestion (relocated from AddWorkout — item 4) ── */}
        <SmartSuggestionCard
          navigation={navigation}
          userId={userId}
          activityTypes={activityTypes}
        />

        {/* ── Load recommendation banner (part of the dashboard) ── */}
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

        {/* ── Home Screen Dashboard: weekly load chart (kept as-is) ── */}
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

        {/* ── B-8: This week at a glance (under the dashboard) ── */}
        {!loading && (
          <WeeklySummaryCard logs={backendLogs} activityTypes={activityTypes} />
        )}

        {/* ── Add Injury (open by default: compact row, chevron expands to grid) ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            activeOpacity={0.8}
            onPress={() => toggleSection(setInjuryExpanded)}
          >
            <View style={styles.sectionHeaderLeft}>
              <MaterialCommunityIcons name="medical-bag" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Add Injury</Text>
            </View>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.expandHint}>{injuryExpanded ? 'Less' : 'All'}</Text>
              <Ionicons
                name={injuryExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.primary}
              />
            </View>
          </TouchableOpacity>

          {injuryTypes.length === 0 ? (
            <Text style={styles.sectionEmpty}>Loading…</Text>
          ) : injuryExpanded ? (
            <View style={styles.cardGrid}>
              {injuryTypes.map((t) => (
                <TouchableOpacity
                  key={t.injuryTypeID}
                  style={styles.gridCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate('InjuryReport', { preselectInjuryTypeId: t.injuryTypeID })
                  }
                >
                  <InjuryIcon injuryTypeId={t.injuryTypeID} size={26} />
                  <Text style={styles.gridCardLabel} numberOfLines={1}>
                    {t.injuryName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardRow}
            >
              {injuryTypes.map((t) => (
                <TouchableOpacity
                  key={t.injuryTypeID}
                  style={styles.typeCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate('InjuryReport', { preselectInjuryTypeId: t.injuryTypeID })
                  }
                >
                  <InjuryIcon injuryTypeId={t.injuryTypeID} size={28} />
                  <Text style={styles.typeCardLabel} numberOfLines={2}>
                    {t.injuryName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
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

      <OnboardingOverlay
        visible={showOnboarding}
        onFinish={handleOnboardingFinish}
      />
    </SafeAreaView>
  );
};

const makeStyles = (C) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },

  // ── Greeting
  greetingWrap: {
    marginBottom: 6,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    color: C.primary,
    fontStyle: 'italic',
  },
  greetingTitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  // ── Foldable section (Add Workout / Add Injury)
  section: {
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandHint: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: C.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionEmpty: {
    color: C.textMuted,
    fontSize: 13,
    paddingVertical: 12,
  },
  cardRow: {
    paddingVertical: 10,
    paddingRight: 4,
    gap: 10,
  },
  // Expanded "show all" grid (Add Workout / Add Injury)
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  gridCard: {
    width: '31.5%',
    height: 84,
    borderRadius: 14,
    backgroundColor: C.cardBackground,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 6,
    marginBottom: 10,
  },
  gridCardLabel: {
    color: C.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Relocated active-injury banner (top of Home)
  activeInjuryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.danger,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  activeInjuryText: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  cardRowSmall: {
    paddingVertical: 6,
    gap: 8,
  },
  typeCard: {
    width: 84,
    height: 92,
    borderRadius: 14,
    backgroundColor: C.cardBackground,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 6,
  },
  typeCardLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Add Injury two-panel layout
  injuryPanels: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  activePanel: {
    flex: 1,
    backgroundColor: C.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  typeSliderPanel: {
    flex: 1.45,
    backgroundColor: C.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  panelTitle: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  panelEmpty: {
    color: C.textMuted,
    fontSize: 12,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
  },
  activeName: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  sevDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  panelMore: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  typeCardSmall: {
    width: 64,
    height: 72,
    borderRadius: 12,
    backgroundColor: C.background,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  typeCardLabelSmall: {
    color: C.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Chart (dashboard)
  chartCard: {
    backgroundColor: C.cardBackground,
    borderRadius: 14,
    padding: 16,
    paddingBottom: 12,
    minHeight: 160,
    marginTop: 14,
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
    marginTop: 14,
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

  // ── Warning banner
  warningBanner: {
    backgroundColor: C.primaryDark,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 4,
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
