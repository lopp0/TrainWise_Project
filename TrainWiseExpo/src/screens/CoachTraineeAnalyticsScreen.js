import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import {
  getTraineePMC,
  getTraineeACWR,
  getTraineeForecast,
  getForecastHistory,
  mlIsOfflineError,
} from '../services/mlApi';
import ScreenHeader from '../components/ScreenHeader';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { loadLevelColor } from './CoachDashboardScreen';

const screenWidth = Dimensions.get('window').width;
const CHART_W = screenWidth - 64; // card has 16 padding each side + inner margin

// Fixed identity colors for the PMC lines. These are SERIES identities (which
// line is which), not load-status thresholds, so they intentionally stay
// constant across themes and don't reuse the semantic green/yellow/red.
const SERIES = { fitness: '#42A5F5', fatigue: '#FFA726', form: '#9575CD' };

// Risk pill / dot color from the Safe|Warning|High class.
const riskColor = (riskClass) => {
  if (riskClass === 'High') return '#f44336';
  if (riskClass === 'Warning') return '#ffee58';
  if (riskClass === 'Safe') return '#00e676';
  return Colors.textMuted;
};

const monthLabel = (monthKey) => {
  if (!monthKey || monthKey.length < 7) return monthKey || '';
  const names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[parseInt(monthKey.slice(5, 7), 10)]} ${monthKey.slice(0, 4)}`;
};

// ---------------------------------------------------------------------------
// Minimal SVG line chart. Supports multiple series, shaded horizontal bands
// (the ACWR safe zone), reference lines (the 1.5 danger line), negative values
// (PMC "form"), and dashed series (the forecast projection). Built on
// react-native-svg because react-native-chart-kit cannot shade a y-band.
// ---------------------------------------------------------------------------
function LineChartSvg({
  width, height, series, yMin, yMax, xLabels = [],
  bands = [], refLines = [], axisColor, labelColor, gridColor,
}) {
  const padL = 36, padR = 12, padT = 10, padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const range = (yMax - yMin) || 1;
  const yOf = (v) => padT + plotH - ((v - yMin) / range) * plotH;
  const xOf = (i, len) => padL + (len <= 1 ? plotW / 2 : (i / (len - 1)) * plotW);

  // 3 y gridlines / labels.
  const ticks = [yMin, yMin + range / 2, yMax];

  return (
    <Svg width={width} height={height}>
      {/* safe-zone / other bands */}
      {bands.map((b, i) => (
        <Rect
          key={`band-${i}`}
          x={padL}
          y={yOf(b.to)}
          width={plotW}
          height={Math.max(0, yOf(b.from) - yOf(b.to))}
          fill={b.color}
          opacity={b.opacity ?? 0.16}
        />
      ))}

      {/* y gridlines + labels */}
      {ticks.map((t, i) => (
        <React.Fragment key={`tick-${i}`}>
          <Line x1={padL} y1={yOf(t)} x2={width - padR} y2={yOf(t)} stroke={gridColor} strokeWidth={0.5} />
          <SvgText x={padL - 6} y={yOf(t) + 3} fontSize={9} fill={labelColor} textAnchor="end">
            {Math.round(t)}
          </SvgText>
        </React.Fragment>
      ))}

      {/* reference lines (e.g. danger 1.5) */}
      {refLines.map((r, i) => (
        <Line
          key={`ref-${i}`}
          x1={padL} y1={yOf(r.y)} x2={width - padR} y2={yOf(r.y)}
          stroke={r.color} strokeWidth={1} strokeDasharray="5,4"
        />
      ))}

      {/* series */}
      {series.map((s, si) => {
        const pts = s.points
          .filter((p) => p.y != null)
          .map((p) => `${xOf(p.x, s.len)},${yOf(p.y)}`)
          .join(' ');
        return (
          <React.Fragment key={`s-${si}`}>
            <Polyline
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 2}
              strokeDasharray={s.dashed ? '5,4' : undefined}
            />
            {s.dots &&
              s.points.filter((p) => p.y != null).map((p, pi) => (
                <Circle
                  key={`d-${si}-${pi}`}
                  cx={xOf(p.x, s.len)}
                  cy={yOf(p.y)}
                  r={2.6}
                  fill={p.color || s.color}
                />
              ))}
          </React.Fragment>
        );
      })}

      {/* x labels (sparse: first / middle / last) */}
      {xLabels.length > 0 &&
        [0, Math.floor((xLabels.length - 1) / 2), xLabels.length - 1].map((idx, i) => (
          <SvgText
            key={`x-${i}`}
            x={xOf(idx, xLabels.length)}
            y={height - 6}
            fontSize={9}
            fill={labelColor}
            textAnchor="middle"
          >
            {xLabels[idx]}
          </SvgText>
        ))}
    </Svg>
  );
}

const shortDate = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const CoachTraineeAnalyticsScreen = ({ route, navigation }) => {
  const { trainee } = route.params || {};
  const traineeId = trainee?.userID ?? trainee?.UserID;
  const traineeName = trainee?.fullName ?? trainee?.FullName ?? `User #${traineeId}`;
  const firstName = traineeName.split(' ')[0];
  const styles = useThemedStyles(makeStyles);

  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [pmc, setPmc] = useState([]);
  const [acwr, setAcwr] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [history, setHistory] = useState([]);
  const [month, setMonth] = useState(null); // null = current month
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const loadAll = useCallback(async () => {
    if (!traineeId) { setLoading(false); return; }
    setLoading(true);
    setOffline(false);
    try {
      const [pmcRes, acwrRes, fcRes, histRes] = await Promise.all([
        getTraineePMC(traineeId).catch((e) => { throw e; }),
        getTraineeACWR(traineeId).catch((e) => { throw e; }),
        getTraineeForecast(traineeId).catch((e) => { throw e; }),
        getForecastHistory(traineeId).catch(() => ({ data: { months: [] } })),
      ]);
      setPmc(pmcRes.data?.series || []);
      setAcwr(acwrRes.data || null);
      setForecast(fcRes.data || null);
      setHistory(histRes.data?.months || []);
    } catch (e) {
      if (mlIsOfflineError(e)) {
        console.warn('[analytics] ML service offline:', e.message);
        setOffline(true);
      } else {
        console.warn('[analytics] load failed:', e?.response?.data || e.message);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [traineeId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Switch which month's forecast is shown (current or a stored past month).
  const selectMonth = async (monthKey) => {
    setMonthPickerOpen(false);
    setMonth(monthKey);
    try {
      const res = await getTraineeForecast(traineeId, monthKey || undefined);
      setForecast(res.data || null);
    } catch (e) {
      console.warn('[analytics] month switch failed:', e.message);
    }
  };

  // ---- PMC chart model ----
  const pmcSeries = (() => {
    if (!pmc.length) return null;
    const fit = pmc.map((p, i) => ({ x: i, y: p.fitness }));
    const fat = pmc.map((p, i) => ({ x: i, y: p.fatigue }));
    const frm = pmc.map((p, i) => ({ x: i, y: p.form }));
    const all = pmc.flatMap((p) => [p.fitness, p.fatigue, p.form]);
    const yMax = Math.max(10, ...all);
    const yMin = Math.min(0, ...all);
    const len = pmc.length;
    return {
      yMin, yMax, len,
      xLabels: pmc.map((p) => shortDate(p.date)),
      series: [
        { points: fit, color: SERIES.fitness, len },
        { points: fat, color: SERIES.fatigue, len },
        { points: frm, color: SERIES.form, len },
      ],
    };
  })();

  // ---- ACWR chart model ----
  const acwrModel = (() => {
    if (!acwr?.series?.length) return null;
    const s = acwr.series;
    const ratios = s.map((p) => p.acRatio).filter((v) => v != null);
    const yMax = Math.max(acwr.danger + 0.2, 1.6, ...(ratios.length ? ratios : [1.6]));
    const len = s.length;
    return {
      yMin: 0, yMax, len,
      xLabels: s.map((p) => shortDate(p.date)),
      bands: [{ from: acwr.safeLow, to: acwr.safeHigh, color: '#00e676', opacity: 0.18 }],
      refLines: [{ y: acwr.danger, color: '#f44336' }],
      series: [{
        points: s.map((p, i) => ({
          x: i, y: p.acRatio,
          color: loadLevelColor(p.level, p.acRatio),
        })),
        color: Colors.textSecondary, len, dots: true, width: 2,
      }],
      latest: ratios.length ? ratios[ratios.length - 1] : null,
    };
  })();

  // ---- Forecast projection sparkline (current AC -> per-week projected) ----
  const projModel = (() => {
    const weeks = forecast?.perTrainee?.weeks || [];
    const pts = [];
    const curAC = forecast?.current?.acRatio;
    if (curAC != null) pts.push(curAC);
    weeks.forEach((w) => { if (w.projACRatio != null) pts.push(w.projACRatio); });
    if (pts.length < 2) return null;
    const yMax = Math.max(1.6, (acwr?.danger ?? 1.5) + 0.2, ...pts);
    const len = pts.length;
    return {
      yMin: 0, yMax, len,
      bands: [{ from: 0.8, to: 1.3, color: '#00e676', opacity: 0.18 }],
      refLines: [{ y: acwr?.danger ?? 1.5, color: '#f44336' }],
      series: [{
        points: pts.map((y, i) => ({ x: i, y })),
        color: Colors.primary, len, dots: true, dashed: true, width: 2,
      }],
    };
  })();

  const eo = forecast?.perTrainee?.endOfMonth;
  const riskClass = forecast?.riskClass;

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Analytics" subtitle={traineeName} onBack={() => navigation.goBack()} />
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Analytics & forecast"
        subtitle={traineeName}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {offline ? (
          <View style={[styles.card, styles.offlineCard]}>
            <Ionicons name="cloud-offline-outline" size={34} color={Colors.textMuted} />
            <Text style={styles.offlineTitle}>Analytics service offline</Text>
            <Text style={styles.offlineText}>
              The Python ML service is not reachable. On the PC, start it with
              {'\n'}cd ml then python app.py, and make sure the phone is on the same WiFi.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadAll} activeOpacity={0.85}>
              <Ionicons name="refresh" size={16} color={Colors.textPrimary} />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ===== Forecast card ===== */}
            <View style={[styles.card, styles.forecastCard]}>
              <View style={styles.forecastHead}>
                <Text style={styles.cardTitle}>Monthly forecast</Text>
                <TouchableOpacity
                  style={styles.monthBtn}
                  onPress={() => setMonthPickerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.monthBtnText}>
                    {month ? monthLabel(month) : `${forecast?.monthName || 'This month'}`}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              {forecast?.stored && (
                <Text style={styles.storedTag}>Saved forecast (read only)</Text>
              )}

              <Text style={styles.forecastLead}>
                If {firstName} keeps training like this:
              </Text>
              <Text style={styles.forecastHeadline}>{forecast?.headline}</Text>

              <View style={styles.riskRow}>
                <View style={[styles.riskPill, { backgroundColor: riskColor(riskClass) }]}>
                  <Text style={styles.riskPillText}>{riskClass || 'No data'}</Text>
                </View>
                {eo?.projACRatio != null && (
                  <Text style={styles.riskMeta}>
                    Projected AC {Number(eo.projACRatio).toFixed(2)} · acute {Math.round(eo.projAcuteLoad)}
                  </Text>
                )}
              </View>

              {projModel && (
                <View style={styles.projChartWrap}>
                  <Text style={styles.projChartLabel}>Projected AC ratio (now to month end)</Text>
                  <LineChartSvg
                    width={CHART_W}
                    height={130}
                    {...projModel}
                    axisColor={Colors.border}
                    labelColor={Colors.textMuted}
                    gridColor={Colors.border}
                  />
                </View>
              )}

              {/* per-week projection rows */}
              {(forecast?.perTrainee?.weeks || []).map((w) => (
                <View key={w.week} style={styles.weekRow}>
                  <Text style={styles.weekLabel}>Week {w.week}</Text>
                  <View style={[styles.weekDot, { backgroundColor: riskColor(w.risk) }]} />
                  <Text style={styles.weekMeta}>
                    AC {w.projACRatio != null ? Number(w.projACRatio).toFixed(2) : '—'} · load {Math.round(w.projAcuteLoad)}
                  </Text>
                </View>
              ))}

              <Text style={styles.confidenceText}>
                Based on {forecast?.weeksElapsed || 0} week(s) this month
                {forecast?.perTrainee?.confidence != null
                  ? ` · confidence ${Math.round(forecast.perTrainee.confidence * 100)}%`
                  : ''}
                {forecast?.perTrainee?.modelType
                  ? ` · ${forecast.perTrainee.modelType} model`
                  : ''}. Refines as the month progresses.
              </Text>

              {forecast?.global?.available && (
                <View style={styles.globalBox}>
                  <View style={styles.globalHeader}>
                    <Ionicons name="flask-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.globalLabel}>Trained model (experimental)</Text>
                  </View>
                  <Text style={styles.globalText}>
                    Projects AC{' '}
                    {forecast.global.projACRatio != null ? Number(forecast.global.projACRatio).toFixed(2) : '—'}
                    {' · '}acute {Math.round(forecast.global.projAcuteLoad)} ({forecast.global.risk}).
                    {' '}Trained on sample data
                    {forecast.global.risk !== riskClass
                      ? ', and it currently disagrees with the recent-pace forecast above'
                      : ''}
                    , so use the forecast above as the primary read.
                  </Text>
                </View>
              )}
            </View>

            {/* ===== PMC chart ===== */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Fitness, fatigue and form</Text>
              <Text style={styles.cardHint}>
                Fitness = chronic load · Fatigue = acute load · Form = fitness minus fatigue
              </Text>
              {pmcSeries ? (
                <>
                  <LineChartSvg
                    width={CHART_W}
                    height={200}
                    {...pmcSeries}
                    axisColor={Colors.border}
                    labelColor={Colors.textMuted}
                    gridColor={Colors.border}
                  />
                  <View style={styles.legendRow}>
                    <Legend color={SERIES.fitness} label="Fitness" styles={styles} />
                    <Legend color={SERIES.fatigue} label="Fatigue" styles={styles} />
                    <Legend color={SERIES.form} label="Form" styles={styles} />
                  </View>
                </>
              ) : (
                <Text style={styles.noData}>No load history yet.</Text>
              )}
            </View>

            {/* ===== ACWR chart ===== */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Training load ratio (ACWR)</Text>
              <Text style={styles.cardHint}>
                Green band 0.8 to 1.3 is the safe zone · above 1.5 is overload risk
              </Text>
              {acwrModel ? (
                <>
                  <LineChartSvg
                    width={CHART_W}
                    height={190}
                    yMin={acwrModel.yMin}
                    yMax={acwrModel.yMax}
                    len={acwrModel.len}
                    series={acwrModel.series}
                    bands={acwrModel.bands}
                    refLines={acwrModel.refLines}
                    xLabels={acwrModel.xLabels}
                    axisColor={Colors.border}
                    labelColor={Colors.textMuted}
                    gridColor={Colors.border}
                  />
                  {acwrModel.latest != null && (
                    <Text style={styles.acwrNow}>
                      Latest ratio:{' '}
                      <Text style={{ color: loadLevelColor(null, acwrModel.latest), fontWeight: '800' }}>
                        {acwrModel.latest.toFixed(2)}
                      </Text>
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.noData}>No ratio history yet.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* month picker */}
      <Modal
        visible={monthPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setMonthPickerOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose month</Text>
            <TouchableOpacity style={styles.monthOption} onPress={() => selectMonth(null)}>
              <Ionicons name="calendar" size={16} color={Colors.primary} />
              <Text style={styles.monthOptionText}>This month (live)</Text>
            </TouchableOpacity>
            {history
              .filter((m) => m.monthKey !== forecast?.monthKey || month != null)
              .map((m) => (
                <TouchableOpacity
                  key={m.monthKey}
                  style={styles.monthOption}
                  onPress={() => selectMonth(m.monthKey)}
                >
                  <View style={[styles.weekDot, { backgroundColor: riskColor(m.riskClass) }]} />
                  <Text style={styles.monthOptionText}>{monthLabel(m.monthKey)}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.monthOptionMeta}>
                    AC {m.projACRatio != null ? Number(m.projACRatio).toFixed(2) : '—'}
                  </Text>
                </TouchableOpacity>
              ))}
            {history.length === 0 && (
              <Text style={styles.noData}>No previous months saved yet.</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const Legend = ({ color, label, styles }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const makeStyles = (C) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    scroll: { padding: 16, paddingBottom: 40 },

    card: {
      backgroundColor: C.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    forecastCard: { borderColor: C.primary, borderWidth: 1.5 },
    cardTitle: { color: C.primary, fontSize: 15, fontWeight: '800' },
    cardHint: { color: C.textMuted, fontSize: 11, marginTop: 4, marginBottom: 10 },
    noData: { color: C.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 16 },

    // forecast
    forecastHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monthBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.cardBackgroundLight,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    },
    monthBtnText: { color: C.primary, fontSize: 12, fontWeight: '700' },
    storedTag: { color: C.textMuted, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
    forecastLead: { color: C.textSecondary, fontSize: 13, marginTop: 10 },
    forecastHeadline: { color: C.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 4 },
    riskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    riskPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    riskPillText: { color: '#0A1628', fontSize: 12, fontWeight: '800' },
    riskMeta: { color: C.textSecondary, fontSize: 12, flexShrink: 1 },

    projChartWrap: { marginTop: 14 },
    projChartLabel: { color: C.textSecondary, fontSize: 11, marginBottom: 4 },

    weekRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    weekLabel: { color: C.textPrimary, fontSize: 13, fontWeight: '700', width: 64 },
    weekDot: { width: 10, height: 10, borderRadius: 5 },
    weekMeta: { color: C.textSecondary, fontSize: 13 },
    confidenceText: { color: C.textMuted, fontSize: 11, marginTop: 14, lineHeight: 16 },
    globalBox: {
      marginTop: 12,
      padding: 10,
      borderRadius: 8,
      backgroundColor: C.cardBackgroundLight,
      borderWidth: 1,
      borderColor: C.border,
    },
    globalHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
    globalLabel: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    globalText: { color: C.textSecondary, fontSize: 12, lineHeight: 16 },

    // legends
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 12, height: 4, borderRadius: 2 },
    legendText: { color: C.textSecondary, fontSize: 12 },
    acwrNow: { color: C.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center' },

    // offline
    offlineCard: { alignItems: 'center', paddingVertical: 28 },
    offlineTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 10 },
    offlineText: { color: C.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
    retryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.primary, borderRadius: 10,
      paddingHorizontal: 18, paddingVertical: 10, marginTop: 16,
    },
    retryText: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },

    // modal
    modalBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center', paddingHorizontal: 24,
    },
    modalCard: {
      backgroundColor: C.cardBackground, borderRadius: 14, padding: 18,
      borderWidth: 1, borderColor: C.border,
    },
    modalTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 12 },
    monthOption: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    monthOptionText: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
    monthOptionMeta: { color: C.textSecondary, fontSize: 12 },
  });

export default CoachTraineeAnalyticsScreen;
