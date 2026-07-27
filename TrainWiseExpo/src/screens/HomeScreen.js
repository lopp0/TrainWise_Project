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
  Modal,
  Alert,
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
import TodayPlanCard from '../components/TodayPlanCard';
import CalorieRing from '../components/CalorieRing';
import GoalCard from '../components/GoalCard';
import ReadinessCard from '../components/ReadinessCard';
import QuestsCard from '../components/QuestsCard';
import ConfettiOverlay from '../components/ConfettiOverlay';
import { checkMilestones, totalsFromLogs } from '../utils/milestones';
import ActivityIcon from '../components/ActivityIcon';
import InjuryIcon from '../components/InjuryIcon';
import { scheduleDailyReminder } from '../api/NotificationService';
import { getStructuredWorkouts } from '../api/HealthConnectService';
import { getWeekStartDate, getWeekDayLabels } from '../constants/weekStart';
import { parseServerDate } from '../utils/serverDate';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { buildRestRecommendation } from '../utils/restRecommendation';
import { processCheckIn, getStreakEmoji } from '../utils/checkInManager';
import {
  getEquippedTitle,
  getEquippedChartTheme,
  findShopItem,
} from '../utils/shopManager';

import {
  DASHBOARD_SECTIONS,
  DEFAULT_DASHBOARD_LAYOUT,
  getDashboardLayout,
  setDashboardLayout,
} from '../utils/dashboardLayout';
import {
  DEFAULT_CALORIE_GOAL,
  getStoredCalorieGoal,
  setCalorieGoal,
  clearCalorieGoal,
} from '../utils/calorieLog';
import { computeBMR, estimateWorkoutCalories } from '../utils/calories';
import { getNutritionDay, addNutritionEntry } from '../services/api';
import ScreenTutorial from '../components/ScreenTutorial';
import { isTutorialDone, markTutorialDone } from '../utils/tutorialManager';

const { width } = Dimensions.get('window');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Feature flag: when false, the coach chat is NOT a floating bubble on Home —
// instead the unread count appears as a badge on the "My network" button (now
// in HomeHeader). Flip to true to bring back the draggable bubble directly on
// the home screen.
const SHOW_COACH_BUBBLE = false;

export const getBarColor = (load) => {
  if (load <= 0) return Colors.cardBackgroundLight;
  if (load < 150) return '#00e676';
  if (load < 300) return '#ffee58';
  if (load < 500) return '#ff9800';
  return '#f44336';
};

const getWeekStart = () => getWeekStartDate(0);

export const buildWeeklyData = (backendLogs, hcWorkouts) => {
  const weekStart = getWeekStart();

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return {
      date: d,
      dayIndex: d.getDay(),
      load: 0,
      source: 'none',
      log: null,
      hcWorkout: null,
    };
  });

  const dateToIndex = {};
  weekDays.forEach((wd, i) => {
    dateToIndex[wd.date.toDateString()] = i;
  });

  (backendLogs || []).forEach((log) => {
    if ((log.isConfirmed ?? log.IsConfirmed) === false) return;
       const key = parseServerDate(log.startTime || log.StartTime).toDateString();
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

  weekDays.forEach((d) => {
    d.load = Math.round(d.load);
  });

  return weekDays;
};

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

const chartStyles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-end', flex: 1 },
  col: { flex: 1, alignItems: 'center' },
  barWrapper: { justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 30, borderRadius: 5 },
  dayLabel: { fontSize: 10, marginTop: 5 },
});

const severityColor = (sev) => {
  const s = Number(sev) || 0;
  if (s <= 3) return '#00e676';
  if (s <= 6) return '#ffee58';
  if (s <= 8) return '#ff9800';
  return '#f44336';
};

// First-visit walkthrough for the Home screen (shown once, tracked by
// tutorialManager under the 'home' key).
const HOME_TUTORIAL_STEPS = [
  {
    icon: '📊',
    title: 'Your Weekly Training Log',
    body: 'The bar chart shows your training load for each day this week. ' +
          'Each bar height represents how hard you trained. ' +
          'Tap any bar to see full details for that day.',
  },
  {
    icon: '➕',
    title: 'Log Your Workouts',
    body: 'Tap "Add a workout" after every training session. ' +
          'The more consistently you log, the more accurate your ' +
          'load analysis becomes.',
  },
  {
    icon: '👥',
    title: 'Connect With Your Coach',
    body: 'Use the Connect tab to link with your personal coach. ' +
          'Your coach can see your training data and send you ' +
          'personalized recommendations.',
  },
  {
    icon: '⚠️',
    title: 'Monitor Your Load',
    body: 'Tap "See warnings" to check your AC Ratio — the key metric ' +
          'that tells you if you are training too hard or too easy. ' +
          'Check it regularly to stay injury-free.',
  },
  {
    icon: '🔥',
    title: 'Daily Check-In Streak',
    body: 'Open the app every day to build your streak and earn coins. ' +
          'Use coins in the Shop to unlock badges and themes. ' +
          'Tap the streak badge at the top to visit the Shop.',
  },
];

const HomeScreen = ({ navigation }) => {
  const { user, userId } = useAuth();
  const { unreadCount } = useMessages();
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef(null);
  useScrollToTop(scrollRef);
  const [backendLogs, setBackendLogs] = useState([]);
  const [hcWorkouts, setHcWorkouts] = useState([]);
  const [dayDrill, setDayDrill] = useState(null); // #9 — { label, workouts } for the tapped bar
  const [loading, setLoading] = useState(true);
  const [unreadWarnings, setUnreadWarnings] = useState(0);
  const [acRatio, setAcRatio] = useState(0);
  const [checkInState, setCheckInState] = useState({ streak: 0, coins: 0 });
  const [coinsEarnedToast, setCoinsEarnedToast] = useState(0);
  const [equippedTitleId, setEquippedTitleId] = useState(null);
  const [equippedChartThemeId, setEquippedChartThemeId] = useState(null);
  const [coach, setCoach] = useState(null);
  const [coachBubbleDismissed, setCoachBubbleDismissed] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const [activityTypes, setActivityTypes] = useState([]);
  const [injuryTypes, setInjuryTypes] = useState([]);
  const [activeInjuries, setActiveInjuries] = useState([]);
  const [workoutExpanded, setWorkoutExpanded] = useState(false);
  const [injuryExpanded, setInjuryExpanded] = useState(false);
  const [coachPlanBadge, setCoachPlanBadge] = useState(0);

  const [dashLayout, setDashLayout] = useState(DEFAULT_DASHBOARD_LAYOUT);
  const [editingDash, setEditingDash] = useState(false);

  const [storedCalGoal, setStoredCalGoal] = useState(null);
  const [calIntake, setCalIntake] = useState(0);
  const [waterMl, setWaterMl] = useState(0);
  const WATER_GOAL_ML = 2500;

  const [celebrate, setCelebrate] = useState(null);

  useEffect(() => {
    if (!backendLogs.length) return;
    (async () => {
      const m = await checkMilestones(totalsFromLogs(backendLogs));
      if (m) setCelebrate(m);
    })();
  }, [backendLogs]);

  useEffect(() => {
    if (userId) getDashboardLayout(userId).then(setDashLayout);
  }, [userId]);

  const persistDashLayout = (next) => {
    setDashLayout(next);
    setDashboardLayout(userId, next);
  };
  const moveSection = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= dashLayout.length) return;
    const next = dashLayout.slice();
    [next[index], next[target]] = [next[target], next[index]];
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    persistDashLayout(next);
  };
  const toggleSectionVisible = (key) => {
    const next = dashLayout.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s));
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    persistDashLayout(next);
  };

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
      } catch {}
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

    try {
      const res = await getCoachesForTrainee(userId);
      const coaches = Array.isArray(res.data) ? res.data : [];
      setCoach(coaches[0] || null);
    } catch {}

    try {
      const [actRes, injRes, activeRes] = await Promise.all([
        getAllActivityTypes(),
        getAllInjuryTypes(),
        getActiveInjuriesByUser(userId),
      ]);
      setActivityTypes(actRes.data || []);
      setInjuryTypes(injRes.data || []);
      setActiveInjuries(activeRes.data || []);
    } catch {}

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

    try {
      const [override, day] = await Promise.all([
        getStoredCalorieGoal(userId),
        getNutritionDay(userId).catch(() => null),
      ]);
      setStoredCalGoal(override);
      if (day?.data?.totals) {
        setCalIntake(day.data.totals.calories || 0);
        setWaterMl(day.data.totals.waterMl || 0);
      }
    } catch {}

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

 

  const checkTutorial = useCallback(async () => {
    try {
      const done = await isTutorialDone('home');
      if (!done) setShowTutorial(true);
    } catch (e) {
      console.warn('[HomeScreen] tutorial check failed:', e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      runCheckIn();
      checkTutorial();
      loadEquippedCosmetics();
      loadData();
    }, [runCheckIn, checkTutorial, loadEquippedCosmetics, loadData])
  );



  const handleTutorialFinish = async () => {
    await markTutorialDone('home');
    setShowTutorial(false);
  };

  useEffect(() => {
    if (coinsEarnedToast > 0) {
      const t = setTimeout(() => setCoinsEarnedToast(0), 2000);
      return () => clearTimeout(t);
    }
  }, [coinsEarnedToast]);

  const weeklyData = buildWeeklyData(backendLogs, hcWorkouts);
 
  const maxLoad = Math.max(...weeklyData.map((d) => d.load), 100);

  const todayStr = new Date().toDateString();
  const burnedToday = (backendLogs || []).reduce((sum, log) => {
    if ((log.isConfirmed ?? log.IsConfirmed) === false) return sum;
       const key = parseServerDate(log.startTime || log.StartTime).toDateString();
    if (key !== todayStr) return sum;
    const measured = Number(log.caloriesBurned ?? log.CaloriesBurned) || 0;
    const kcal = measured > 0 ? measured : estimateWorkoutCalories({
      durationMin: log.duration ?? log.Duration,
      exertion: log.exertionLevel ?? log.ExertionLevel,
      weightKg: user?.weight,
    });
    return sum + kcal;
  }, 0);

  const formulaBase = computeBMR(user);
  const usingFormulaBase = storedCalGoal == null;
  const calGoal = storedCalGoal ?? formulaBase ?? DEFAULT_CALORIE_GOAL;

  const refreshNutrition = async () => {
    try {
      const day = await getNutritionDay(userId);
      setCalIntake(day.data?.totals?.calories || 0);
      setWaterMl(day.data?.totals?.waterMl || 0);
    } catch {}
  };
  const addCalories = async (kcal) => {
    try {
      await addNutritionEntry(userId, { kind: 'food', name: 'Quick add', calories: kcal });
      await refreshNutrition();
    } catch {}
  };
  const addWater = async (ml) => {
    try {
      await addNutritionEntry(userId, { kind: 'water', waterMl: ml });
      await refreshNutrition();
    } catch {}
  };
  const resetCalories = () => { refreshNutrition(); };

  const changeCalGoal = async (g) => {
    const apply = async () => {
      const next = await setCalorieGoal(userId, g);
      setStoredCalGoal(next);
    };
    if (usingFormulaBase && formulaBase != null) {
      Alert.alert(
        'Set your own daily base?',
        `Your base of ${formulaBase} kcal is not a guess: it is calculated from your profile (height, weight, age and sex) with the Mifflin-St Jeor equation, and it updates by itself whenever you change your profile.\n\n` +
          'If you set your own number it stays fixed at that value until you reset it.',
        [
          { text: 'Keep formula', style: 'cancel' },
          { text: 'Set my own', onPress: apply },
        ],
      );
      return;
    }
    apply();
  };

  const resetCalGoal = () => {
    Alert.alert(
      'Use the calculated base?',
      formulaBase != null
        ? `This puts your daily base back to ${formulaBase} kcal, calculated from your profile with the Mifflin-St Jeor equation, and lets it follow your profile again.`
        : 'This puts your daily base back to the value calculated from your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use formula',
          onPress: async () => {
            await clearCalorieGoal(userId);
            setStoredCalGoal(null);
          },
        },
      ],
    );
  };

  const recommendation = acRatio > 0 ? buildRestRecommendation({ acRatio }) : null;
  const equippedTitleItem = equippedTitleId ? findShopItem(equippedTitleId) : null;
  const equippedChartTheme = equippedChartThemeId
    ? findShopItem(equippedChartThemeId)
    : null;
  const chartThemeColors = equippedChartTheme?.colors || null;

  const injuryNameById = (id) =>
    injuryTypes.find((i) => i.injuryTypeID === id)?.injuryName || `Injury #${id}`;

  const handleBarPress = (i) => {
    const day = weeklyData[i];
    if (!day?.date) return;
    const dayStr = day.date.toDateString();
    const nameById = {};
    (activityTypes || []).forEach((t) => {
      nameById[t.activityTypeID ?? t.ActivityTypeID] = t.typeName ?? t.TypeName;
    });
    const workouts = (backendLogs || [])
      .filter((log) => (log.isConfirmed ?? log.IsConfirmed) !== false)
            .filter((log) => parseServerDate(log.startTime || log.StartTime).toDateString() === dayStr)
      .map((log) => ({
        id: log.activityID ?? log.ActivityID,
        name: nameById[log.activityTypeID ?? log.ActivityTypeID] || 'Workout',
        duration: log.duration ?? log.Duration ?? 0,
        exertion: log.exertionLevel ?? log.ExertionLevel ?? 0,
        load: Number(log.calculatedLoadForSession ?? log.CalculatedLoadForSession ?? 0),
        start: log.startTime || log.StartTime,
      }))
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    if (workouts.length === 0) return;
    const label = day.date.toLocaleDateString('en-US', {
      weekday: 'long', day: 'numeric', month: 'short',
    });
    setDayDrill({ label, workouts, dayIndex: i });
  };

  const editWorkoutFromDrill = (w) => {
    const di = dayDrill?.dayIndex;
    setDayDrill(null);
    navigation.navigate('Stats', { selectedDayIndex: di, editLogId: w.id });
  };

  const toggleSection = (setter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter((o) => !o);
  };

  const renderDashSection = (key) => {
    switch (key) {
      case 'smart':
        return (
          <SmartSuggestionCard navigation={navigation} userId={userId} activityTypes={activityTypes} />
        );
      case 'recommendation':
        return recommendation ? (
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
        ) : null;
      case 'chart':
        return (
          <View style={styles.chartCard}>
            {loading ? (
              <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 40 }} />
            ) : weeklyData.every((d) => d.load === 0) ? (
              <Text style={styles.noDataText}>No workouts this week</Text>
            ) : (
              <View style={styles.chartRow}>
                <View style={styles.yAxis}>
                  <Text style={styles.yLabel}>{maxLoad}</Text>
                  <Text style={styles.yLabel}>0</Text>
                </View>
                <WeeklyBarChart
                  weeklyData={weeklyData}
                  maxValue={maxLoad}
                  onBarPress={handleBarPress}
                  themeColors={chartThemeColors}
                />
              </View>
            )}
          </View>
        );
      case 'summary':
        return !loading ? (
          <>
            <WeeklySummaryCard
              logs={backendLogs}
              activityTypes={activityTypes}
              experienceLevel={user?.experienceLevel}
              userId={userId}
            />
          </>
        ) : null;
      case 'calories':
        return (
          <CalorieRing
            goal={calGoal}
            usingFormula={usingFormulaBase}
            onResetGoal={resetCalGoal}
            intake={calIntake}
            burned={burnedToday}
            water={waterMl}
            waterGoal={WATER_GOAL_ML}
            onAdd={addCalories}
            onAddWater={addWater}
            onReset={resetCalories}
            onSetGoal={changeCalGoal}
            onOpenDetail={() => navigation.navigate('Nutrition')}
          />
        );
      case 'recovery':
        return <ReadinessCard acRatio={acRatio} />;
      case 'goal':
        return <GoalCard userId={userId} logs={backendLogs} />;
      case 'quests':
        return (
          <QuestsCard
            logs={backendLogs}
            onClaimed={(balance) => setCheckInState((s) => ({ ...s, coins: balance }))}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
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

        <View style={styles.greetingWrap}>
          <Text style={styles.greeting} numberOfLines={1}>
            Hi, {user?.fullName || 'Athlete'}!
          </Text>
          {equippedTitleItem?.titleText ? (
            <View style={styles.greetingTitlePill}>
              <Text style={styles.greetingTitle}>{equippedTitleItem.titleText}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Achievements')}
          >
            <Ionicons name="medal-outline" size={16} color={Colors.primary} />
            <Text style={styles.quickBtnText}>Achievements</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ExerciseLibrary')}
          >
            <Ionicons name="library-outline" size={16} color={Colors.primary} />
            <Text style={styles.quickBtnText}>Exercises</Text>
          </TouchableOpacity>
        </View>

        <TodayPlanCard navigation={navigation} userId={userId} />

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

        {acRatio > 1.3 && activeInjuries.length > 0 && (
          <TouchableOpacity
            style={styles.reinjuryCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Warnings')}
          >
            <MaterialCommunityIcons name="alert-octagon" size={20} color={Colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.reinjuryTitle}>Re-injury risk</Text>
              <Text style={styles.reinjuryBody} numberOfLines={2}>
                Load is spiking (AC {acRatio.toFixed(2)}) while an injury is still active. Ease off
                to avoid a setback.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

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

        <View style={styles.customizeRow}>
          <TouchableOpacity
            style={styles.customizeBtn}
            activeOpacity={0.8}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setEditingDash((e) => !e);
            }}
          >
            <Ionicons
              name={editingDash ? 'checkmark' : 'options-outline'}
              size={15}
              color={Colors.primary}
            />
            <Text style={styles.customizeText}>{editingDash ? 'Done' : 'Customize'}</Text>
          </TouchableOpacity>
        </View>

        {dashLayout.map((section, index) => {
          const content = renderDashSection(section.key);
          if (!editingDash) {
            return section.visible && content ? (
              <View key={section.key}>{content}</View>
            ) : null;
          }
          return (
            <View
              key={section.key}
              style={[styles.dashEditWrap, !section.visible && styles.dashEditHidden]}
            >
              <View style={styles.dashEditBar}>
                <Text style={styles.dashEditLabel} numberOfLines={1}>
                  {DASHBOARD_SECTIONS[section.key]}
                </Text>
                <View style={styles.dashEditBtns}>
                  <TouchableOpacity
                    onPress={() => moveSection(index, -1)}
                    disabled={index === 0}
                    style={styles.dashEditIcon}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={18}
                      color={index === 0 ? Colors.textMuted : Colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveSection(index, 1)}
                    disabled={index === dashLayout.length - 1}
                    style={styles.dashEditIcon}
                  >
                    <Ionicons
                      name="arrow-down"
                      size={18}
                      color={index === dashLayout.length - 1 ? Colors.textMuted : Colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => toggleSectionVisible(section.key)}
                    style={styles.dashEditIcon}
                  >
                    <Ionicons
                      name={section.visible ? 'eye' : 'eye-off'}
                      size={18}
                      color={section.visible ? Colors.primary : Colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              {section.visible && content}
            </View>
          );
        })}

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

      <TouchableOpacity
        style={styles.chatBubble}
        onPress={() => navigation.navigate('AIChat')}
        activeOpacity={0.85}
      >
        <Ionicons name="sparkles" size={24} color="#fff" />
      </TouchableOpacity>

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

  

      <ScreenTutorial
        visible={showTutorial}
        steps={HOME_TUTORIAL_STEPS}
        onFinish={handleTutorialFinish}
      />

      {celebrate && (
        <>
          <ConfettiOverlay onDone={() => setCelebrate(null)} />
          <View pointerEvents="none" style={styles.milestoneToast}>
            <Text style={styles.milestoneText}>{celebrate.label}</Text>
          </View>
        </>
      )}

      <Modal
        visible={!!dayDrill}
        transparent
        animationType="fade"
        onRequestClose={() => setDayDrill(null)}
      >
        <TouchableOpacity
          style={styles.drillBackdrop}
          activeOpacity={1}
          onPress={() => setDayDrill(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.drillSheet} onPress={() => {}}>
            <Text style={styles.drillTitle}>{dayDrill?.label}</Text>
            <Text style={styles.drillSub}>
              {dayDrill?.workouts?.length}{' '}
              {dayDrill?.workouts?.length === 1 ? 'workout' : 'workouts'} ·{' '}
              {dayDrill?.workouts?.reduce((s, w) => s + w.load, 0)} load
            </Text>
            {dayDrill?.workouts?.map((w, idx) => (
              <TouchableOpacity
                key={w.id ?? idx}
                style={styles.drillRow}
                activeOpacity={0.7}
                onPress={() => editWorkoutFromDrill(w)}
              >
                <View style={styles.drillDot}>
                  <Ionicons name="barbell" size={16} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drillName}>{w.name}</Text>
                  <Text style={styles.drillMeta}>
                    {w.duration} min · exertion {w.exertion}/10
                  </Text>
                </View>
                <Text style={styles.drillLoad}>{w.load}</Text>
                <Ionicons name="create-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
            <Text style={styles.drillHint}>Tap a workout to edit its stats</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 36 },

  greetingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    color: C.primary,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  greetingTitlePill: {
    backgroundColor: C.primary + '22',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  greetingTitle: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '800',
  },

  section: { marginTop: 14 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expandHint: { color: C.primary, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
  sectionEmpty: { color: C.textMuted, fontSize: 13, paddingVertical: 12 },
  cardRow: { paddingVertical: 10, paddingRight: 4, gap: 10 },
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
  activeInjuryText: { flex: 1, color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  reinjuryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.cardBackground,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: C.danger,
    borderWidth: 1,
    borderColor: C.danger,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  reinjuryTitle: { color: C.danger, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  reinjuryBody: { color: C.textSecondary, fontSize: 12, lineHeight: 16 },
  cardRowSmall: { paddingVertical: 6, gap: 8 },
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

  injuryPanels: { flexDirection: 'row', gap: 10, marginTop: 8 },
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
  panelEmpty: { color: C.textMuted, fontSize: 12 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  activeName: { flex: 1, color: C.textPrimary, fontSize: 12, fontWeight: '600' },
  sevDot: { width: 9, height: 9, borderRadius: 5 },
  panelMore: { color: C.textMuted, fontSize: 11, marginTop: 4 },
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

  quickRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.cardBackground,
    borderWidth: 1,
    borderColor: C.border,
  },
  quickBtnText: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },

  drillBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  drillSheet: {
    backgroundColor: C.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
  },
  drillTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '900' },
  drillSub: { color: C.textSecondary, fontSize: 13, marginTop: 2, marginBottom: 12 },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  drillDot: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.cardBackgroundLight,
    alignItems: 'center', justifyContent: 'center',
  },
  drillName: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  drillMeta: { color: C.textMuted, fontSize: 12, marginTop: 1 },
  drillLoad: { color: C.primary, fontSize: 15, fontWeight: '900', marginRight: 6 },
  drillHint: { color: C.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
  drillIconBtn: { paddingHorizontal: 4 },

  milestoneToast: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    backgroundColor: C.cardBackground,
    borderWidth: 2,
    borderColor: C.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    zIndex: 9500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  milestoneText: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },

  customizeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    marginBottom: -4,
  },
  customizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cardBackground,
  },
  customizeText: { color: C.primary, fontSize: 12, fontWeight: '700' },
  dashEditWrap: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.primary,
    borderStyle: 'dashed',
    padding: 8,
  },
  dashEditHidden: { opacity: 0.55, borderColor: C.border },
  dashEditBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  dashEditLabel: { flex: 1, color: C.textPrimary, fontSize: 13, fontWeight: '800' },
  dashEditBtns: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dashEditIcon: { padding: 6 },

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
  chartRow: { flexDirection: 'row', alignItems: 'flex-end' },
  yAxis: { width: 30, justifyContent: 'space-between', paddingBottom: 22, paddingTop: 4 },
  yLabel: { color: C.textMuted, fontSize: 11 },
  noDataText: { color: C.textMuted, textAlign: 'center', fontSize: 14, paddingVertical: 30 },

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
  recBannerIcon: { marginRight: 12 },
  recBannerTextWrap: { flex: 1 },
  recBannerTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  recBannerBody: { color: C.textSecondary, fontSize: 12, lineHeight: 16 },

  warningBanner: {
    backgroundColor: C.primaryDark,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 4,
    alignItems: 'center',
  },
  warningBannerTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  warningBannerSubtitle: { color: C.textPrimary, fontSize: 14, marginTop: 4, textAlign: 'center' },

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