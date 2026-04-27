import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {BarChart} from 'react-native-chart-kit';
import {Colors, Fonts, Spacing} from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import { getActivityLogsByUser } from '../services/api';
import { useAuth } from '../api/AuthContext';
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

const determineLoadLevel = (ratio) => {
  if (ratio == null || ratio <= 0) return 'Green';
  if (ratio > 1.3) return 'Red';
  if (ratio >= 0.8) return 'Yellow';
  return 'Green';
};

const sumSessionLoadsInRange = (logs, startDate, endDate) => {
  return logs.reduce((sum, log) => {
    const st = new Date(log.startTime || log.StartTime);
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
      : `Load is building nicely (AC ratio ${ratio.toFixed(2)}). Stay consistent — one more steady session should keep you in the sweet spot.`;
  }
  return `You're in the safe zone (AC ratio ${ratio.toFixed(2)}). Good time to add a challenging session if you feel fresh.`;
};

const WarningsDashboardScreen = ({navigation}) => {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weeklyLoad, setWeeklyLoad] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [weekLabels, setWeekLabels] = useState(['Sun','Mon','Tue','Wed','Thu','Fri','Sat']);
  const [currentLoadLevel, setCurrentLoadLevel] = useState('Green');
  const [acRatio, setAcRatio] = useState(0);
  const [stressScore, setStressScore] = useState(0);
  const [recommendation, setRecommendation] = useState(
    'No recommendation available yet. Log some workouts to get started.',
  );
  const [helpTopic, setHelpTopic] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [allLogs, setAllLogs] = useState([]);
  const [allLoadHistory, setAllLoadHistory] = useState([]);
  const [weekStartDay, setWeekStartDayState] = useState(getWeekStartDay());

  useEffect(() => {
    const unsub = subscribeWeekStart((day) => setWeekStartDayState(day));
    return () => unsub && unsub();
  }, []);

  const HELP_TEXT = {
    status: {
      title: 'Current Status',
      body:
        'Green = safe training zone. Yellow = monitor fatigue, consider easing off. Red = high injury risk — rest or reduce intensity.',
    },
    acRatio: {
      title: 'AC Ratio',
      body:
        'Acute-to-Chronic workload ratio. Compares your last 7 days of training to your longer-term average. Around 0.8–1.3 is the "sweet spot"; above 1.5 is high risk.',
    },
    stress: {
      title: 'Stress Score',
      body:
        'A 0–100 reading of how hard your last 7 days have been compared to your personal baseline. Higher means more accumulated fatigue.',
    },
    weekly: {
      title: 'Weekly Training Load',
      body:
        'Each bar shows your 7-day rolling acute load at the end of that day. A plateau across days is normal; sharp jumps indicate heavy recent sessions.',
    },
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    renderWeek(allLogs, allLoadHistory, weekOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, allLogs, allLoadHistory, weekStartDay]);

  const renderWeek = (logs, loadHistory, offset) => {
    const weekStart = getWeekStartDate(offset, weekStartDay);
    const labels = getWeekDayLabels(weekStartDay);
    const weekData = new Array(7).fill(0);

    // Per-day session-load sum for the displayed week only.
    // Two sessions on the same day sum together. Empty days stay 0.
    logs.forEach((log) => {
      const st = new Date(log.startTime || log.StartTime);
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

    // Ratio / level semantics:
    //   - chronic > 0 : standard ACWR.
    //   - chronic = 0 AND acute = 0 : no training, Green (rest).
    //   - chronic = 0 AND acute > 0 : bootstrapping after rest — treat as
    //     high relative risk (undefined ratio → Red/Yellow by acute volume).
    let ratio = 0;
    let level = 'Green';
    if (chronic > 0) {
      ratio = acute / chronic;
      level = determineLoadLevel(ratio);
    } else if (acute > 0) {
      // No prior baseline: flag spike risk based on absolute volume.
      // 1000+ in a single week after rest is a strong spike.
      ratio = acute >= 1000 ? 2.0 : acute >= 300 ? 1.1 : 0.9;
      level = determineLoadLevel(ratio);
    }

    // Stress 0-100 scale.
    let stress = 0;
    if (chronic > 0) {
      stress = Math.max(0, Math.min(100, Math.round((acute / chronic) * 50)));
    } else if (acute > 0) {
      // Without a baseline we can't normalize; scale by absolute acute load.
      stress = Math.max(0, Math.min(100, Math.round(acute / 20)));
    }

    setCurrentLoadLevel(level);
    setAcRatio(ratio);
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
                    {backgroundColor: getLevelColor(currentLoadLevel)},
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {color: getLevelColor(currentLoadLevel)},
                  ]}>
                  {currentLoadLevel}
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
                  <Text style={styles.metricValue}>{acRatio.toFixed(2)}</Text>
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

            {/* Weekly Load Chart */}
            <Card>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>Weekly Training Load</Text>
                <TouchableOpacity onPress={() => setHelpTopic('weekly')} hitSlop={8}>
                  <Ionicons name="help-circle-outline" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
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
              <BarChart
                data={chartData}
                width={screenWidth - Spacing.lg * 4}
                height={220}
                chartConfig={chartConfig}
                fromZero
                showValuesOnTopOfBars
                withInnerLines
                segments={4}
                style={styles.chart}
              />
              <Text style={styles.chartCaption}>Daily session load (load units)</Text>
            </Card>

            {/* Recommendation */}
            <Card>
              <Text style={styles.cardTitle}>Smart Recommendation</Text>
              <Text style={styles.recommendationText}>{recommendation}</Text>
            </Card>
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
  <View style={styles.secondaryRow}>
    <TouchableOpacity
      style={styles.secondaryButton}
      onPress={() => navigation.navigate('AddWorkout')}>
      <Text style={styles.secondaryButtonText}>Add Workout</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.secondaryButton}
      onPress={() => navigation.navigate('InjuryReport')}>
      <Text style={styles.secondaryButtonText}>Report Injury</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.secondaryButton}
      onPress={() => navigation.navigate('Settings')}>
      <Text style={styles.secondaryButtonText}>Settings</Text>
    </TouchableOpacity>
  </View>
</View>
    </View>
  );
};

const styles = StyleSheet.create({
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
