import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import AcwrTrendChart from './AcwrTrendChart';
import { Colors, Fonts, Spacing } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { getLoadAnalytics } from '../services/api';
import { getTraineeAnalytics } from '../services/mlApi';
import { computeLoadAnalytics } from '../utils/loadSeries';
import { getWeekStartDate } from '../constants/weekStart';

/**
 * "Load Trend" + "Training Analysis" cards, shared by the trainee Load tab and
 * the coach's trainee detail so both sides read the exact same numbers.
 *
 * Data comes from GET /dailyload/user/{id}/analytics (C# LoadAnalyticsBL). If
 * that endpoint is unreachable (older deployed backend, offline) the same
 * series is computed on-device from the logs the screen already fetched
 * (utils/loadSeries.js mirrors the C# math).
 *
 * The method toggle (Classic rolling vs Smooth EWMA) is a VIEW preference,
 * persisted per device. The official status / recommendations stay on Classic
 * so trainee, coach and stored history always agree.
 */
const METHOD_KEY = '@trainwise_acwr_method'; // 'rolling' | 'ewma'
const screenWidth = Dimensions.get('window').width;

const levelColor = (level) => {
  if (level === 'Red') return Colors.red;
  if (level === 'Yellow') return Colors.yellow;
  return Colors.green;
};

const HELP = {
  trend: {
    title: 'Load Trend',
    body:
      'This chart follows your acute-to-chronic ratio day by day. The green band (0.8-1.3) is the sweet spot: training enough to improve without spiking injury risk. Above the band you are ramping up too fast; staying below it for long means detraining. With an active injury the safe range tightens.\n\nClassic compares your last 7 days to your 4-week average. Smooth (EWMA) gives extra weight to your most recent sessions, so it reacts faster to sudden spikes and settles gradually after rest. Your official status and your coach’s view always use Classic; Smooth is an extra lens used in sports science (Williams 2017).',
  },
  analysis: {
    title: 'Training Analysis',
    body:
      'Weekly Volume: your total training load per week. Keep increases gradual, roughly 10% per week is a safe ramp.\n\nIntensity Mix: how your training time splits across easy (effort 1-3), moderate (4-6) and hard (7-10) sessions over the last 4 weeks. Endurance athletes often aim for about 70/10/20.\n\nVariety: how repetitive your week is (monotony, Foster 1998). Mixing hard days, easy days and real rest days lowers injury risk even at the same total volume.',
  },
};

const LoadAnalyticsSection = ({
  userId,
  experienceLevel,
  hasActiveInjury = false,
  logs = null,
  cardStyle = null, // override Card margins when embedded in a padded screen
}) => {
  const styles = useThemedStyles(makeStyles);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('rolling');
  const [helpTopic, setHelpTopic] = useState(null);
  // Measured inner card width so the SVG chart fits both host layouts (Load
  // tab Cards vs the coach detail's padded scroll). Fallback = Load tab math.
  const [innerWidth, setInnerWidth] = useState(screenWidth - Spacing.lg * 4);

  useEffect(() => {
    AsyncStorage.getItem(METHOD_KEY)
      .then((v) => v && setMethod(v))
      .catch(() => {});
  }, []);

  const pickMethod = (m) => {
    setMethod(m);
    AsyncStorage.setItem(METHOD_KEY, m).catch(() => {});
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Same architecture as the coach forecast: the Python ML service is the
      // primary source. If it's offline we fall back to the C# analytics
      // endpoint, then to the on-device mirror — so the charts always render.
      try {
        const res = await getTraineeAnalytics(userId, 56);
        if (!cancelled && res?.data?.series?.length) {
          setData(res.data);
          return;
        }
      } catch {
        // ML service offline — try the C# backend next
      }
      try {
        const res = await getLoadAnalytics(userId, 56);
        if (!cancelled && res?.data?.series) {
          setData(res.data);
          return;
        }
      } catch {
        // C# endpoint missing / offline: fall through to the on-device mirror
      }
      if (!cancelled) {
        setData(
          logs
            ? computeLoadAnalytics(logs, experienceLevel, { hasActiveInjury })
            : null,
        );
      }
    })().finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // logs is refreshed by the parent's pull-to-refresh; recompute then too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, logs]);

  const chartSeries = useMemo(() => {
    if (!data?.series) return [];
    return data.series.map((p) => ({
      date: p.date,
      ratio: method === 'ewma' ? p.ewmaRatio : p.rollingRatio,
      level: method === 'ewma' ? p.ewmaLevel : p.rollingLevel,
    }));
  }, [data, method]);

  const today = chartSeries.length ? chartSeries[chartSeries.length - 1] : null;
  const weekAgo =
    chartSeries.length >= 8 ? chartSeries[chartSeries.length - 8] : null;
  const delta =
    today?.ratio != null && weekAgo?.ratio != null
      ? today.ratio - weekAgo.ratio
      : null;

  // Weekly volume: calendar weeks (app week-start preference), oldest first.
  const weeks = useMemo(() => {
    if (!data?.series) return [];
    const out = [];
    for (let off = -7; off <= 0; off++) {
      const ws = getWeekStartDate(off);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      let total = 0;
      data.series.forEach((p) => {
        const d = new Date(p.date);
        if (d >= ws && d <= we) total += p.dailyLoad || 0;
      });
      out.push({ start: ws, total: Math.round(total), current: off === 0 });
    }
    return out;
  }, [data]);

  const last7 = useMemo(() => {
    if (!data?.series) return { now: 0, prev: 0 };
    const s = data.series;
    const sum = (a, b) =>
      s.slice(a, b).reduce((acc, p) => acc + (p.dailyLoad || 0), 0);
    return { now: sum(s.length - 7, s.length), prev: sum(s.length - 14, s.length - 7) };
  }, [data]);

  const volDeltaPct =
    last7.prev > 0 ? Math.round(((last7.now - last7.prev) / last7.prev) * 100) : null;

  const summary = data?.summary;
  const monotony = summary?.monotony ?? 0;
  const variety =
    monotony <= 0
      ? null
      : monotony < 1.5
        ? { label: 'Good variety', color: Colors.green }
        : monotony <= 2
          ? { label: 'Getting repetitive', color: Colors.yellow }
          : { label: 'Too repetitive', color: Colors.red };

  const hasIntensity =
    summary && summary.lowPct + summary.moderatePct + summary.highPct > 0;

  const chartWidth = innerWidth;
  const maxWeek = Math.max(...weeks.map((w) => w.total), 1);

  if (!userId) return null;

  return (
    <>
      {/* ---------------- Load Trend ---------------- */}
      <Card style={cardStyle}>
        <View
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - innerWidth) > 1) setInnerWidth(w);
          }}
          style={styles.titleRow}>
          <Text style={styles.cardTitle}>Load Trend</Text>
          <TouchableOpacity onPress={() => setHelpTopic('trend')} hitSlop={8}>
            <Ionicons name="help-circle-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* method toggle */}
        <View style={styles.segmentRow}>
          {[
            { key: 'rolling', label: 'Classic' },
            { key: 'ewma', label: 'Smooth (EWMA)' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.segment, method === opt.key && styles.segmentActive]}
              onPress={() => pickMethod(opt.key)}>
              <Text
                style={[
                  styles.segmentText,
                  method === opt.key && styles.segmentTextActive,
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 40 }} />
        ) : !data || !chartSeries.length ? (
          <Text style={styles.emptyText}>
            Log a few workouts to see your load trend here.
          </Text>
        ) : (
          <>
            {/* today readout */}
            {today?.ratio != null && (
              <View style={styles.todayRow}>
                <Text style={styles.todayValue}>{today.ratio.toFixed(2)}</Text>
                <View
                  style={[styles.levelPill, { backgroundColor: `${levelColor(today.level)}22`, borderColor: levelColor(today.level) }]}>
                  <Text style={[styles.levelPillText, { color: levelColor(today.level) }]}>
                    {today.level === 'Green'
                      ? 'On track'
                      : today.level === 'Yellow'
                        ? 'Watch it'
                        : 'High risk'}
                  </Text>
                </View>
                {delta != null && (
                  <Text style={styles.deltaText}>
                    {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)} vs last week
                  </Text>
                )}
              </View>
            )}

            <AcwrTrendChart
              series={chartSeries}
              safeLow={data.safeLow ?? 0.8}
              safeHigh={data.safeHigh ?? 1.3}
              overload={data.overload ?? 1.5}
              width={chartWidth}
              height={190}
            />
            <Text style={styles.chartCaption}>
              {method === 'ewma'
                ? 'Smooth (EWMA) reacts faster to recent sessions'
                : 'Classic: last 7 days vs your 4-week average'}
            </Text>
            {data.baselineEstablished === false && (
              <View style={styles.noteBox}>
                <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={styles.noteText}>
                  Building your baseline: until you have 7 training days in the last
                  4 weeks, the ratio is judged against your experience level.
                </Text>
              </View>
            )}
          </>
        )}
      </Card>

      {/* ---------------- Training Analysis ---------------- */}
      {!loading && data && chartSeries.length > 0 && (
        <Card style={cardStyle}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>Training Analysis</Text>
            <TouchableOpacity onPress={() => setHelpTopic('analysis')} hitSlop={8}>
              <Ionicons name="help-circle-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* weekly volume */}
          <Text style={styles.sectionLabel}>Weekly Volume</Text>
          <View style={styles.volumeRow}>
            {weeks.map((w, i) => {
              const fillPct = Math.max((w.total / maxWeek) * 100, w.total > 0 ? 6 : 0);
              return (
                <View key={i} style={styles.volumeCol}>
                  {/* bar grows from the baseline to fillPct; the value label
                      sits just above the bar top so it never floats */}
                  <View style={styles.volumeTrack}>
                    <View style={[styles.volumeBarWrap, { height: `${fillPct}%` }]}>
                      {w.total > 0 && (
                        <Text style={styles.volumeValue} numberOfLines={1}>
                          {w.total >= 1000 ? `${(w.total / 1000).toFixed(1)}k` : w.total}
                        </Text>
                      )}
                      <View
                        style={[
                          styles.volumeBar,
                          {
                            backgroundColor: w.current ? Colors.primary : Colors.primaryLight,
                            opacity: w.current ? 1 : 0.6,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text
                    style={[styles.volumeLabel, w.current && styles.volumeLabelNow]}
                    numberOfLines={1}>
                    {w.current
                      ? 'now'
                      : `${w.start.toLocaleString('en-US', { month: 'short' })} ${w.start.getDate()}`}
                  </Text>
                </View>
              );
            })}
          </View>
          {volDeltaPct != null && (
            <Text
              style={[
                styles.volumeDelta,
                volDeltaPct > 20 && { color: Colors.yellow },
              ]}>
              {volDeltaPct >= 0 ? '+' : ''}
              {volDeltaPct}% vs the previous 7 days
              {volDeltaPct > 20 ? ' · ramp up gently, aim for ~10%' : ''}
            </Text>
          )}

          {/* intensity mix */}
          <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>
            Intensity Mix (last 4 weeks)
          </Text>
          {hasIntensity ? (
            [
              { label: 'Easy', pct: summary.lowPct, color: Colors.green },
              { label: 'Moderate', pct: summary.moderatePct, color: Colors.yellow },
              { label: 'Hard', pct: summary.highPct, color: Colors.red },
            ].map((z) => (
              <View key={z.label} style={styles.zoneRow}>
                <Text style={styles.zoneLabel}>{z.label}</Text>
                <View style={styles.zoneTrack}>
                  <View
                    style={[
                      styles.zoneFill,
                      { width: `${Math.max(z.pct, 1)}%`, backgroundColor: z.color },
                    ]}
                  />
                </View>
                <Text style={styles.zonePct}>{Math.round(z.pct)}%</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No workouts in the last 4 weeks yet.</Text>
          )}

          {/* variety */}
          {variety && (
            <View style={styles.varietyRow}>
              <Ionicons name="shuffle-outline" size={16} color={variety.color} style={{ marginRight: 6 }} />
              <Text style={[styles.varietyText, { color: variety.color }]}>
                {variety.label}
              </Text>
              <Text style={styles.varietySub}>
                {' · '}
                {summary.restDays7} rest day{summary.restDays7 === 1 ? '' : 's'} this week
              </Text>
            </View>
          )}
        </Card>
      )}

      {/* help modal (same look as the Load tab's help) */}
      <Modal
        visible={!!helpTopic}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpTopic(null)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.helpBackdrop}
          onPress={() => setHelpTopic(null)}>
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>{helpTopic ? HELP[helpTopic].title : ''}</Text>
            <Text style={styles.helpBody}>{helpTopic ? HELP[helpTopic].body : ''}</Text>
            <TouchableOpacity style={styles.helpClose} onPress={() => setHelpTopic(null)}>
              <Text style={styles.helpCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const makeStyles = (Colors) =>
  StyleSheet.create({
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    cardTitle: {
      color: Colors.primary,
      fontSize: Fonts.subtitleSize,
      fontWeight: Fonts.bold,
    },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: Colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: 3,
      marginBottom: Spacing.md,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: Colors.primary,
    },
    segmentText: {
      color: Colors.textSecondary,
      fontSize: Fonts.captionSize + 1,
      fontWeight: Fonts.semiBold,
    },
    segmentTextActive: {
      color: Colors.textPrimary,
    },
    todayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    todayValue: {
      color: Colors.textPrimary,
      fontSize: 26,
      fontWeight: Fonts.bold,
      marginRight: Spacing.sm,
    },
    levelPill: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    levelPillText: {
      fontSize: Fonts.captionSize,
      fontWeight: Fonts.bold,
    },
    deltaText: {
      color: Colors.textMuted,
      fontSize: Fonts.captionSize,
      marginLeft: 'auto',
    },
    chartCaption: {
      textAlign: 'center',
      marginTop: Spacing.xs,
      color: Colors.textMuted,
      fontSize: Fonts.captionSize,
    },
    noteBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: Colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.sm,
      marginTop: Spacing.sm,
    },
    noteText: {
      flex: 1,
      color: Colors.textSecondary,
      fontSize: Fonts.captionSize,
      lineHeight: 17,
    },
    emptyText: {
      color: Colors.textSecondary,
      fontSize: Fonts.bodySize,
      lineHeight: 20,
      marginVertical: Spacing.sm,
    },
    sectionLabel: {
      color: Colors.textSecondary,
      fontSize: Fonts.captionSize,
      fontWeight: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.sm,
    },
    volumeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 110,
      gap: 5,
      paddingTop: 16, // headroom so the value label above the tallest bar isn't clipped
    },
    volumeCol: {
      flex: 1,
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
    },
    // The track holds the full column height; the bar wrap grows from the
    // bottom to fillPct of it, with the value label sitting just above the
    // bar (so the number always rides on the bar top, never floats).
    volumeTrack: {
      width: '100%',
      flex: 1,
      justifyContent: 'flex-end',
    },
    volumeBarWrap: {
      width: '100%',
      justifyContent: 'flex-end',
    },
    // absolute so the number floats just above the bar top WITHOUT eating
    // into the bar's percentage height.
    volumeValue: {
      position: 'absolute',
      top: -14,
      left: 0,
      right: 0,
      color: Colors.textSecondary,
      fontSize: 10,
      fontWeight: Fonts.semiBold,
      textAlign: 'center',
    },
    volumeBar: {
      width: '100%',
      flex: 1,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      minHeight: 3,
    },
    volumeLabel: {
      color: Colors.textMuted,
      fontSize: 9,
      marginTop: 4,
      textAlign: 'center',
    },
    volumeLabelNow: {
      color: Colors.textSecondary,
      fontWeight: Fonts.semiBold,
    },
    volumeDelta: {
      color: Colors.textMuted,
      fontSize: Fonts.captionSize,
      marginTop: Spacing.sm,
    },
    zoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    zoneLabel: {
      width: 68,
      color: Colors.textPrimary,
      fontSize: Fonts.captionSize + 1,
    },
    zoneTrack: {
      flex: 1,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.background,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
    },
    zoneFill: {
      height: '100%',
      borderRadius: 5,
    },
    zonePct: {
      width: 40,
      textAlign: 'right',
      color: Colors.textSecondary,
      fontSize: Fonts.captionSize,
    },
    varietyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    varietyText: {
      fontSize: Fonts.captionSize + 1,
      fontWeight: Fonts.bold,
    },
    varietySub: {
      color: Colors.textMuted,
      fontSize: Fonts.captionSize,
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

export default LoadAnalyticsSection;
