import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '../theme/useThemedStyles';
import { aggregateLoadHistory } from '../utils/loadHistory';

/**
 * #115 — Monthly / yearly load history card. A Week / Month / Year toggle over a
 * simple bar chart of total session load per bucket. Self-contained: aggregates
 * from the logs passed in.
 *
 * props: { logs }
 */
const RANGES = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];
const CHART_H = 110;

const LoadHistoryCard = ({ logs }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const [range, setRange] = useState('month');

  const { bars, max, total } = useMemo(() => aggregateLoadHistory(logs, range), [logs, range]);
  const empty = total === 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>LOAD HISTORY</Text>
        <View style={styles.toggle}>
          {RANGES.map((r) => {
            const active = range === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                onPress={() => setRange(r.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {empty ? (
        <Text style={styles.empty}>No load logged in this range yet.</Text>
      ) : (
        <>
          <View style={styles.chart}>
            {bars.map((b, i) => {
              const h = b.load > 0 ? Math.max(4, (b.load / max) * CHART_H) : 3;
              return (
                <View key={i} style={styles.col}>
                  <View style={styles.barWrap}>
                    <View style={[styles.bar, { height: h }]} />
                  </View>
                  <Text style={styles.barLabel} numberOfLines={1}>{b.label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.total}>Total load this {range}: {total}</Text>
        </>
      )}
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    card: { backgroundColor: C.cardBackground, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    headerText: { color: C.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    toggle: { flexDirection: 'row', backgroundColor: C.inputBackground, borderRadius: 8, padding: 3 },
    toggleBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
    toggleBtnActive: { backgroundColor: C.primary },
    toggleText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
    toggleTextActive: { color: '#fff' },
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + 20 },
    col: { flex: 1, alignItems: 'center' },
    barWrap: { height: CHART_H, justifyContent: 'flex-end' },
    bar: { width: 14, borderRadius: 4, backgroundColor: C.primary },
    barLabel: { color: C.textMuted, fontSize: 9, marginTop: 4 },
    total: { color: C.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 8, fontWeight: '700' },
    empty: { color: C.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  });
  s._colors = C;
  return s;
};

export default LoadHistoryCard;
