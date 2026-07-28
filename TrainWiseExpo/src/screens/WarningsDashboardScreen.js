import React, {useState, useEffect, useMemo} from 'react';
import ScreenTutorial from '../components/ScreenTutorial';
import { isTutorialDone, markTutorialDone } from '../utils/tutorialManager';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BarChart, LineChart} from 'react-native-chart-kit';
import {Colors, Fonts, Spacing} from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import LoadAnalyticsSection from '../components/LoadAnalyticsSection';
import RiskGauge from '../components/RiskGauge';
import { aggregateLoadHistory } from '../utils/loadHistory';
import { computeInjuryRisk } from '../utils/injuryRisk';
import { getActivityLogsByUser, getActiveInjuriesByUser, getCoachRecommendationsByUser } from '../services/api';
import { useAuth } from '../api/AuthContext';
import { buildRestRecommendation } from '../utils/restRecommendation';
import { parseServerDate } from '../utils/serverDate';
import {
  getWeekStartDate,
  getWeekStartDay,
  getWeekDayLabels,
  subscribeWeekStart,
} from '../constants/weekStart';


const screenWidth = Dimensions.get('window').width;

const formatShortDate = (d) =>
  `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;

const getWeekRangeLabel = (offset, weekStartDay) => {
  const ws = getWeekStartDate(offset, weekStartDay);
  const we = new Date(ws);
  we.setDate(ws.getDate() + 6);
  if (offset === 0) return `This week · ${formatShortDate(ws)} – ${formatShortDate(we)}`;
  if (offset === -1) return `Last week · ${formatShortDate(ws)} – ${formatShortDate(we)}`;
  return `${formatShortDate(ws)} – ${formatShortDate(we)}`;
};

// Same bands as backend DetermineLoadLevel; an active injury tightens the
// Red line to 1.2 (Yellow runs 0.8..<1.2 — no gap).
const determineLoadLevel = (ratio, hasInjury = false) => {
  if (ratio == null || ratio <= 0) return 'Green';
  if (hasInjury) {
    if (ratio >= 1.2) return 'Red';
    if (ratio >= 0.8) return 'Yellow';
    return 'Green';
  }
  if (ratio > 1.3) return 'Red';
  if (ratio >= 0.8) return 'Yellow';
  return 'Green';
};

const sumSessionLoadsInRange = (logs, startDate, endDate) => {
  return logs.reduce((sum, log) => {
    const st = parseServerDate(log.startTime || log.StartTime);
    if (st >= startDate && st <= endDate) {
      return sum + Number(
        log.calculatedLoadForSession ?? log.CalculatedLoadForSession ?? 0,
      );
    }
    return sum;
  }, 0);
};

const buildRecommendation = (level, ratio, stress) => {
  if (ratio <= 0) {
    return 'No recent training detected. Log a workout to start tracking your load.';
  }
  if (level === 'Red') {
    return ratio > 1.5
      ? `Your training load has spiked sharply (AC ratio ${ratio.toFixed(2)}). Take 1–2 full rest days, hydrate, and prioritize sleep before your next session.`
      : `Load is in the high-risk zone (AC ratio ${ratio.toFixed(2)}). Swap your next session for an easy recovery workout or a rest day.`;
  }
  if (level === 'Yellow') {
    return ratio >= 1.0
      ? `You're training above baseline (AC ratio ${ratio.toFixed(2)}). Keep intensity moderate and avoid back-to-back hard sessions this week.`
      : `Load is building nicely (AC ratio ${ratio.toFixed(2)}). Stay consistent. One more steady session should keep you in the sweet spot.`;
  }
  return `You're in the safe zone (AC ratio ${ratio.toFixed(2)}). Good time to add a challenging session if you feel fresh.`;
};

// Experience-based expected WEEKLY load (matches LoadParameters seed:
// Beginner/Regular/Advanced acute loads). Used as the cold-start chronic floor.
const BOOTSTRAP_WEEKLY = { 1: 150, 2: 280, 3: 420 };

const WARNINGS_TUTORIAL_STEPS = [
  {
    icon: '📈',
    title: 'Your Load Trend Chart',
    body: 'This chart shows how your AC Ratio has changed over time. ' +
          'The X-axis shows dates, the Y-axis shows your AC Ratio value. ' +
          'A rising line means your load is increasing.',
  },
  {
    icon: '🟢',
    title: 'The Safe Zone (Sweet Spot)',
    body: 'The GREEN zone (0.8 to 1.3) is your sweet spot. ' +
          'Training here builds fitness without injury risk. ' +
          'Aim to keep your line inside this zone consistently.',
  },
  {
    icon: '🔴',
    title: 'The Danger Zone',
    body: 'Above 1.5 (RED zone) means you are pushing too hard. ' +
          'Research shows this significantly increases injury risk. ' +
          'Rest or reduce intensity immediately when you are here.',
  },
  {
    icon: '🟡',
    title: 'Easing Off Zone',
    body: 'Below 0.8 means you are training too little compared to ' +
          'your normal level. This causes detraining — your fitness ' +
          'declines and you become injury-prone when you return.',
  },
  {
    icon: '🔄',
    title: 'Classic vs Smooth (EWMA)',
    body: 'Classic AC Ratio = last 7 days vs your 4-week average. ' +
          'Smooth (EWMA) is a weighted version that reacts faster to ' +
          'recent changes. Both are valid — check both for a full picture.',
  },
  {
    icon: '🩹',
    title: 'Injuries Change Your Thresholds',
    body: 'When you have an active injury, the safe zone becomes stricter. ' +
          'The app protects you by warning you at lower load levels ' +
          'until you mark your injury as recovered.',
  },
];

const WarningsDashboardScreen = () => {
  const { userId, user } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    isTutorialDone('warnings').then((d) => { if (!d) setShowTutorial(true); });
  }, []);
  const [weeklyLoad, setWeeklyLoad] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [weekLabels, setWeekLabels] = useState(['Sun','Mon','Tue','Wed','Thu','Fri','Sat']);
  const [currentLoadLevel, setCurrentLoadLevel] = useState('Green');
  const [acRatio, setAcRatio] = useState(0);
  const [acuteLoad, setAcuteLoad] = useState(0);
  const [stressScore, setStressScore] = useState(0);
  const [recommendation, setRecommendation] = useState(
    'No recommendation available yet. Log some workouts to get started.',
  );
  const [helpTopic, setHelpTopic] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [loadRange, setLoadRange] = useState('week'); // #6 — 'week' | 'month' | 'year'
  const [allLogs, setAllLogs] = useState([]);
  const [allLoadHistory, setAllLoadHistory] = useState([]);
  const [weekStartDay, setWeekStartDayState] = useState(getWeekStartDay());
  const [hasActiveInjury, setHasActiveInjury] = useState(false);
  const [coachRecs, setCoachRecs] = useState([]);
  const [coachOpen, setCoachOpen] = useState(false);     // foldable coach section
  const [seenRecIds, setSeenRecIds] = useState(() => new Set()); // device-local "read" set

  const SEEN_KEY = `@trainwise_seen_coachrecs_${userId}`;

  useEffect(() => {
    const unsub = subscribeWeekStart((day) => setWeekStartDayState(day));
    return () => unsub && unsub();
  }, []);

  // Load the device-local set of already-seen coach recommendations.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SEEN_KEY);
        if (raw) setSeenRecIds(new Set(JSON.parse(raw)));
      } catch {
        // ignore — defaults to "all unseen"
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const recId = (rec) => String(rec.recID ?? rec.RecID);
  const coachUnseen = coachRecs.filter((r) => !seenRecIds.has(recId(r))).length;

  // #183 — injury-risk gauge (ACWR + Foster monotony/strain), from the same
  // confirmed logs the dashboard already loaded.
  const injuryRisk = useMemo(
    () => computeInjuryRisk(allLogs, user?.experienceLevel ?? user?.ExperienceLevel, hasActiveInjury),
    [allLogs, user, hasActiveInjury],
  );

  // #10 — the "Current Status" AC ratio + level must agree with the Injury-Risk
  // gauge and the Load-trend chart. All three read the SAME rolling ACWR
  // (computeLoadAnalytics, surfaced via injuryRisk.ratio). The week-based number
  // is only used when browsing a PAST week, where "current" rolling doesn't apply.
  const isCurrentWeek = weekOffset === 0;
  const displayRatio =
    isCurrentWeek && injuryRisk.ratio != null ? injuryRisk.ratio : acRatio;
  const displayLevel =
    isCurrentWeek && injuryRisk.ratio != null
      ? determineLoadLevel(displayRatio, hasActiveInjury)
      : currentLoadLevel;
  // Rebuild the recommendation text from the SAME rolling ratio so the number in
  // the "Smart recommendation" can't disagree with the headline AC ratio.
  const displayRecommendation =
    isCurrentWeek && injuryRisk.ratio != null
      ? buildRecommendation(displayLevel, displayRatio, stressScore)
      : recommendation;

  // Folding the coach section open marks everything in it as seen (persisted),
  // so the red unseen-count badge clears and stays cleared across visits.
  const toggleCoach = async () => {
    const willOpen = !coachOpen;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCoachOpen(willOpen);
    if (willOpen && coachUnseen > 0) {
      const next = new Set(seenRecIds);
      coachRecs.forEach((r) => next.add(recId(r)));
      setSeenRecIds(next);
      try {
        await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
      } catch {
        // non-fatal
      }
    }
  };

  const HELP_TEXT = {
    status: {
      title: 'Current Status',
      body:
        'Green = safe training zone. Yellow = monitor fatigue, consider easing off. Red = high injury risk, rest or reduce intensity.',
    },
    acRatio: {
      title: 'AC Ratio',
      body:
        'Acute-to-Chronic workload ratio. Compares your last 7 days of training to your longer-term average. Around 0.8–1.3 is the "sweet spot"; above 1.5 is high risk.',
    },
    acuteLoad: {
      title: 'Weekly Acute Load',
      body:
        'Total session-load units accumulated across the displayed week. The "acute" half of the AC ratio: what your body is processing right now. The color matches your current risk level.',
    },
    stress: {
      title: 'Stress Score',
      body:
        'A 0–100 reading of how hard your last 7 days have been compared to your personal baseline. Higher means more accumulated fatigue.',
    },
    weekly: {
      title: 'Training Load chart',
      body:
        'Load for one session = duration (min) × exertion (1-10). This chart totals that load, and the Week / Month / Year buttons change the bucket:\n\n' +
        '• WEEK — one bar per day for the selected week. Use the arrows to page back through previous weeks. Bar colours follow your daily load: green is light, yellow moderate, orange high, red very high.\n\n' +
        '• MONTH — one bar per week for the last 6 weeks. Good for spotting whether your weekly volume is climbing, flat, or dropping.\n\n' +
        '• YEAR — a line showing the total load of each of the last 12 calendar months, so you can see your season shape and long layoffs at a glance.\n\n' +
        'Only confirmed workouts count. Pending Health Connect imports are excluded until you confirm them, so a bar can rise after you confirm a sync.',
    },
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    renderWeek(allLogs, allLoadHistory, weekOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, allLogs, allLoadHistory, weekStartDay, hasActiveInjury]);

  const renderWeek = (logs, loadHistory, offset) => {
    const weekStart = getWeekStartDate(offset, weekStartDay);
    const labels = getWeekDayLabels(weekStartDay);
    const weekData = new Array(7).fill(0);

    // Per-day session-load sum for the displayed week only.
    // Two sessions on the same day sum together. Empty days stay 0.
    logs.forEach((log) => {
      const st = parseServerDate(log.startTime || log.StartTime);
      const d = new Date(st);
      d.setHours(0, 0, 0, 0);
      const diffDays = Math.round(
        (d - weekStart) / (1000 * 60 * 60 * 24),
      );
      if (diffDays >= 0 && diffDays < 7) {
        weekData[diffDays] += Number(
          log.calculatedLoadForSession ?? log.CalculatedLoadForSession ?? 0,
        );
      }
    });
    setWeeklyLoad(weekData.map((v) => Math.round(v)));
    setWeekLabels(labels);

    // Standard ACWR (Gabbett 2016, "coupled" form):
    //   acute   = sum of session loads for the displayed week (7 days)
    //   chronic = AVERAGE weekly load over the trailing 28-day window that
    //             INCLUDES the displayed week → sum(28 days ending weekEnd) / 4
    // This is the formula used in sports-science papers and matches the
    // backend LoadCalculationBL. The previous "uncoupled" form (prior 21
    // days only) made the chronic baseline volatile and the displayed
    // ratio swing dramatically between adjacent weeks.
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const chronic28Start = new Date(weekStart);
    chronic28Start.setDate(weekStart.getDate() - 21); // 21 days before weekStart + 7 displayed = 28
    chronic28Start.setHours(0, 0, 0, 0);

    const acute = sumSessionLoadsInRange(logs, weekStart, weekEnd);
    const chronic28Sum = sumSessionLoadsInRange(logs, chronic28Start, weekEnd);
    const chronic = chronic28Sum / 4; // weekly-equivalent average over 28 days

    // Cold-start guard + ramp (mirrors backend LoadCalculationBL.EffectiveChronic
    // and utils/acwr.js — change one, change all):
    //   < 7 days with load > 0 in the 28-day window: floor the chronic at the
    //     experience-based expected weekly load (brand-new user's first session
    //     isn't a fixed 4.0; a returning athlete isn't a false Red).
    //   >= 7 active days: divide by the weeks actually covered instead of a
    //     fixed 4 — chronic = sum28 / min(4, covered/7), covered from the first
    //     loaded day. A steady 2-week-old user reads ~1.0, not a false Red 2.0.
    const dayLoads = new Map();
    logs.forEach((log) => {
      const st = parseServerDate(log.startTime || log.StartTime);
      if (st >= chronic28Start && st <= weekEnd) {
        const dd = new Date(st);
        dd.setHours(0, 0, 0, 0);
        const load = Number(
          log.calculatedLoadForSession ?? log.CalculatedLoadForSession ?? 0,
        );
        dayLoads.set(dd.getTime(), (dayLoads.get(dd.getTime()) || 0) + load);
      }
    });
    const activeDayKeys = [...dayLoads.entries()].filter(([, v]) => v > 0).map(([k]) => k);
    const baselineEstablished = activeDayKeys.length >= 7;
    const bootstrapWeekly =
      BOOTSTRAP_WEEKLY[user?.experienceLevel ?? user?.ExperienceLevel] || 150;
    let effChronic;
    if (!baselineEstablished) {
      effChronic = Math.max(chronic, bootstrapWeekly);
    } else {
      const firstActive = Math.min(...activeDayKeys);
      const coverEnd = Math.min(weekEnd.getTime(), Date.now());
      const endDay = new Date(coverEnd);
      endDay.setHours(0, 0, 0, 0);
      const covered = Math.min(
        28,
        Math.max(7, Math.round((endDay.getTime() - firstActive) / 86400000) + 1),
      );
      effChronic = chronic28Sum / Math.min(4, covered / 7);
    }

    // Ratio / level semantics (effChronic = chronic with the cold-start floor):
    //   - effChronic > 0 : standard ACWR.
    //   - effChronic = 0 AND acute > 0 : bootstrapping — flag by absolute volume.
    let ratio = 0;
    let level = 'Green';
    if (effChronic > 0) {
      ratio = acute / effChronic;
      level = determineLoadLevel(ratio, hasActiveInjury);
    } else if (acute > 0) {
      ratio = acute >= 1000 ? 2.0 : acute >= 300 ? 1.1 : 0.9;
      level = determineLoadLevel(ratio, hasActiveInjury);
    }

    // Stress 0-100 scale.
    let stress = 0;
    if (effChronic > 0) {
      stress = Math.max(0, Math.min(100, Math.round((acute / effChronic) * 50)));
    } else if (acute > 0) {
      stress = Math.max(0, Math.min(100, Math.round(acute / 20)));
    }

    setCurrentLoadLevel(level);
    setAcRatio(ratio);
    setAcuteLoad(Math.round(acute));
    setStressScore(stress);
    setRecommendation(buildRecommendation(level, ratio, stress));
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const logsResponse = await getActivityLogsByUser(userId);
      const logs = (logsResponse.data || []).filter(
        (l) => (l.isConfirmed ?? l.IsConfirmed) !== false,
      );
      setAllLogs(logs);
      setAllLoadHistory([]); // unused — kept for prior code compatibility

      try {
        const injuriesResponse = await getActiveInjuriesByUser(userId);
        const injuries = injuriesResponse.data || [];
        setHasActiveInjury(injuries.length > 0);
      } catch {
        setHasActiveInjury(false);
      }

      try {
        const recsResponse = await getCoachRecommendationsByUser(userId);
        const recs = (recsResponse.data || []).slice().sort(
          (a, b) => new Date(b.date ?? b.Date) - new Date(a.date ?? a.Date),
        );
        setCoachRecs(recs);
      } catch {
        setCoachRecs([]);
      }
    } catch (error) {
      console.log('Dashboard load error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    // All stats computed from ActivityLogs directly now — just re-fetch.
    await loadDashboardData();
  };

  const getLevelColor = (level) => {
    if (level === 'Red') return Colors.red;
    if (level === 'Yellow') return Colors.yellow;
    return Colors.green;
  };

  const chartConfig = {
    backgroundGradientFrom: Colors.cardBackground,
    backgroundGradientTo: Colors.cardBackground,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 64, 129, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(176, 190, 197, ${opacity})`,
    barPercentage: 0.7,
    fillShadowGradient: Colors.primaryLight,
    fillShadowGradientOpacity: 1,
    propsForBackgroundLines: {
      stroke: Colors.border,
      strokeDasharray: '4',
    },
  };

  const chartMax = Math.max(100, Math.ceil(Math.max(...weeklyLoad, 0) / 500) * 500);
  const chartData = {
    labels: weekLabels,
    datasets: [
      {
        data: weeklyLoad.length > 0 ? weeklyLoad : [0],
      },
      // Hidden dataset to pin the Y-axis max to a clean round number
      { data: [chartMax], withDots: false, color: () => 'transparent' },
    ],
  };

  // #6 — month/year use the same bar chart, fed by aggregateLoadHistory (this
  // replaces the separate Load-History card — one chart, one UI, a range toggle).
  // #3 fix: use a SINGLE dataset (the earlier max-pin second dataset rendered a
  // phantom bar), and append a trailing empty slot so chart-kit doesn't clip the
  // tall last (current-period) bar at the right edge.
  const historyAgg = loadRange === 'week' ? null : aggregateLoadHistory(allLogs, loadRange);
  const activeChartData =
    loadRange === 'week'
      ? chartData
      : {
          labels: [...historyAgg.bars.map((b) => b.label), ''],
          datasets: [
            { data: [...(historyAgg.bars.length ? historyAgg.bars.map((b) => b.load) : [0]), 0] },
          ],
        };

  // #4 — the Year view used to be 12 cramped bars (labels + values overlapping on
  // phone width, per device-test #4). A smooth area/line chart reads the 12-month
  // trend far more cleanly. Label every OTHER month (anchored so the current month
  // is always labelled) to stop the x-axis crowding.
  const yearBars = loadRange === 'year' && historyAgg ? historyAgg.bars : [];
  const yearLineData = {
    labels: yearBars.map((b, i) => ((yearBars.length - 1 - i) % 2 === 0 ? b.label : '')),
    datasets: [
      { data: yearBars.length ? yearBars.map((b) => b.load) : [0], strokeWidth: 3 },
    ],
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Warnings" subtitle="Training Load Overview" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator
            size="large"
            color={Colors.primary}
            style={{marginTop: 40}}
          />
        ) : (
          <>
            {/* Load Level Indicator */}
            <Card>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>Current Status</Text>
                <TouchableOpacity onPress={() => setHelpTopic('status')} hitSlop={8}>
                  <Ionicons name="help-circle-outline" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {backgroundColor: getLevelColor(displayLevel)},
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {color: getLevelColor(displayLevel)},
                  ]}>
                  {displayLevel}
                </Text>
              </View>
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <View style={styles.metricLabelRow}>
                    <Text style={styles.metricLabel}>AC Ratio</Text>
                    <TouchableOpacity onPress={() => setHelpTopic('acRatio')} hitSlop={8}>
                      <Ionicons name="help-circle-outline" size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.metricValue}>{displayRatio.toFixed(2)}</Text>
                </View>
                <View style={styles.metric}>
                  <View style={styles.metricLabelRow}>
                    <Text style={styles.metricLabel}>Acute Load</Text>
                    <TouchableOpacity onPress={() => setHelpTopic('acuteLoad')} hitSlop={8}>
                      <Ionicons name="help-circle-outline" size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.metricValue, { color: getLevelColor(displayLevel) }]}>
                    {acuteLoad}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <View style={styles.metricLabelRow}>
                    <Text style={styles.metricLabel}>Stress</Text>
                    <TouchableOpacity onPress={() => setHelpTopic('stress')} hitSlop={8}>
                      <Ionicons name="help-circle-outline" size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.metricValue}>{stressScore}/100</Text>
                </View>
              </View>
            </Card>

            {/* Training Load chart — Week / Month / Year in ONE chart (#6).
                No extra marginTop: the previous card's marginBottom already
                supplies the standard 16px gap (device-test #5). */}
            <Card>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>Training Load</Text>
                <TouchableOpacity onPress={() => setHelpTopic('weekly')} hitSlop={8}>
                  <Ionicons name="help-circle-outline" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Range toggle (folds in the old Load-History card) */}
              <View style={styles.rangeToggle}>
                {['week', 'month', 'year'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.rangeBtn, loadRange === r && styles.rangeBtnActive]}
                    onPress={() => setLoadRange(r)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.rangeText, loadRange === r && styles.rangeTextActive]}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Week nav only in week mode */}
              {loadRange === 'week' && (
                <View style={styles.weekNavRow}>
                  <TouchableOpacity
                    style={styles.weekNavBtn}
                    onPress={() => setWeekOffset((o) => o - 1)}
                    hitSlop={8}
                  >
                    <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.weekNavLabel}>{getWeekRangeLabel(weekOffset, weekStartDay)}</Text>
                  <TouchableOpacity
                    style={[styles.weekNavBtn, weekOffset >= 0 && styles.weekNavBtnDisabled]}
                    onPress={() => weekOffset < 0 && setWeekOffset((o) => o + 1)}
                    disabled={weekOffset >= 0}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={weekOffset >= 0 ? Colors.textMuted : Colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              )}
              {loadRange === 'year' ? (
                <LineChart
                  data={yearLineData}
                  width={screenWidth - Spacing.lg * 4}
                  height={220}
                  chartConfig={{
                    ...chartConfig,
                    // Filled area under a smooth pink line, matching the app accent.
                    fillShadowGradientFrom: Colors.primary,
                    fillShadowGradientTo: Colors.cardBackground,
                    fillShadowGradientFromOpacity: 0.35,
                    fillShadowGradientToOpacity: 0.02,
                    propsForDots: { r: '4', strokeWidth: '2', stroke: Colors.primary },
                  }}
                  bezier
                  fromZero
                  withInnerLines
                  withVerticalLines={false}
                  segments={4}
                  style={styles.chart}
                />
              ) : (
                <BarChart
                  data={activeChartData}
                  width={screenWidth - Spacing.lg * 4}
                  height={220}
                  chartConfig={chartConfig}
                  fromZero
                  showValuesOnTopOfBars
                  withInnerLines
                  segments={4}
                  style={styles.chart}
                />
              )}
              <Text style={styles.chartCaption}>
                {loadRange === 'week'
                  ? 'Daily session load (load units)'
                  : loadRange === 'month'
                  ? 'Weekly session load, last 6 weeks (load units)'
                  : 'Monthly session load trend, last 12 months (load units)'}
              </Text>
            </Card>

            {/* #183 — Injury-Risk Gauge, BELOW the load chart. No margin here:
                the gauge carries the same marginBottom as a <Card> and the card
                above supplies the gap, so weekly load → injury risk → load trend
                are all spaced evenly (device-test #5). paddingHorizontal matches
                the Card marginHorizontal so the edges line up. */}
            <View style={{ paddingHorizontal: Spacing.lg }}>
              <RiskGauge risk={injuryRisk} />
            </View>

            {/* Load Trend (Classic/EWMA toggle) + Training Analysis. Computed
                by the backend LoadAnalyticsBL; falls back to the on-device
                mirror (utils/loadSeries) using the logs fetched above. */}
            <LoadAnalyticsSection
              userId={userId}
              experienceLevel={user?.experienceLevel ?? user?.ExperienceLevel}
              hasActiveInjury={hasActiveInjury}
              logs={allLogs}
            />

            {/* Recommendation */}
            <Card>
              {(() => {
                const visual = buildRestRecommendation({
                  acRatio: displayRatio,
                  loadLevel: displayLevel,
                  hasActiveInjury,
                });
                return (
                  <>
                    <View style={styles.recHeader}>
                      <View
                        style={[
                          styles.recIconWrap,
                          { backgroundColor: `${visual.color}22`, borderColor: visual.color },
                        ]}
                      >
                        <Ionicons name={visual.icon} size={22} color={visual.color} />
                      </View>
                      <View style={styles.recTitleWrap}>
                        <Text style={styles.recEyebrow}>Smart Recommendation</Text>
                        <Text style={[styles.recTitle, { color: visual.color }]}>
                          {visual.title}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.recommendationText}>{displayRecommendation}</Text>
                    {visual.injuryWarning && (
                      <View style={styles.injuryBox}>
                        <Ionicons
                          name="medkit-outline"
                          size={16}
                          color={Colors.red}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.injuryText}>{visual.injuryWarning}</Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </Card>

            {/* Messages from your coach (foldable). Collapsed shows just the
                title + an unseen-count red dot; tap to unfold the messages. */}
            {coachRecs.length > 0 && (
              <Card>
                <TouchableOpacity style={styles.coachHeader} activeOpacity={0.7} onPress={toggleCoach}>
                  <View style={styles.coachHeaderLeft}>
                    <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.coachHeaderTitle}>From your coach</Text>
                    {coachUnseen > 0 && (
                      <View style={styles.coachBadge}>
                        <Text style={styles.coachBadgeText}>{coachUnseen > 99 ? '99+' : coachUnseen}</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons
                    name={coachOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
                {coachOpen &&
                  coachRecs.map((rec) => (
                    <View key={rec.recID ?? rec.RecID} style={styles.coachRec}>
                      <Text style={styles.coachRecTitle}>{rec.title ?? rec.Title}</Text>
                      <Text style={styles.coachRecText}>{rec.text ?? rec.Text}</Text>
                      <Text style={styles.coachRecDate}>
                        {new Date(rec.date ?? rec.Date).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={!!helpTopic}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpTopic(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.helpBackdrop}
          onPress={() => setHelpTopic(null)}
        >
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>
              {helpTopic ? HELP_TEXT[helpTopic].title : ''}
            </Text>
            <Text style={styles.helpBody}>
              {helpTopic ? HELP_TEXT[helpTopic].body : ''}
            </Text>
            <TouchableOpacity
              style={styles.helpClose}
              onPress={() => setHelpTopic(null)}
            >
              <Text style={styles.helpCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.bottomActions}>
        <PrimaryButton title="Refresh" onPress={handleRefresh} />
      </View>
      <ScreenTutorial
        visible={showTutorial}
        steps={WARNINGS_TUTORIAL_STEPS}
        onFinish={() => { setShowTutorial(false); markTutorialDone('warnings'); }}
      />
    </View>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: 20,
    fontWeight: Fonts.bold,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.sm,
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginTop: 4,
  },
  chart: {
    borderRadius: 12,
    marginLeft: -Spacing.md,
  },
  recommendationText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    lineHeight: 22,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  recIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  recTitleWrap: {
    flex: 1,
  },
  recEyebrow: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  recTitle: {
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
  },
  injuryBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F4433620',
    borderRadius: 8,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  injuryText: {
    flex: 1,
    color: Colors.red,
    fontSize: Fonts.captionSize + 1,
    lineHeight: 18,
    fontWeight: Fonts.semiBold,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coachHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  coachHeaderTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
  },
  coachBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  coachRec: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  coachRecTitle: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.bold,
    marginBottom: 2,
  },
  coachRecText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
    lineHeight: 20,
  },
  coachRecDate: {
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
    marginTop: 4,
  },
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,

  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },

  secondaryRow: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  paddingHorizontal: Spacing.md,
},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chartCaption: {
    textAlign: 'center',
    marginTop: Spacing.xs,
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
  },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  // #6 range toggle
  rangeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    padding: 3,
    marginBottom: Spacing.sm,
  },
  rangeBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  rangeBtnActive: { backgroundColor: Colors.primary },
  rangeText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  rangeTextActive: { color: '#fff' },
  weekNavBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  weekNavBtnDisabled: {
    opacity: 0.4,
  },
  weekNavLabel: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
    flex: 1,
    textAlign: 'center',
  },
  helpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  helpCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  helpTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.sm,
  },
  helpBody: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  helpClose: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  helpCloseText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
});



export default WarningsDashboardScreen;
