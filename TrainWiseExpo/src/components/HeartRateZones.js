import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { zoneForBpm } from '../utils/hrZones';

/**
 * #122 — Heart-rate zone breakdown. Given per-zone data (time-in-zone from HC
 * samples) renders a stacked bar + legend. When only an average BPM is available
 * it degrades to a single "average zone" indicator. Zone colors are fixed
 * (semantic), the rest follows the theme.
 *
 * props: { zones, avgBpm, maxHr }
 */
const HeartRateZones = ({ zones, avgBpm, maxHr }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;

  const hasDistribution = Array.isArray(zones) && zones.some((z) => z.count > 0);
  const avgZone = !hasDistribution && avgBpm && maxHr ? zoneForBpm(avgBpm, maxHr) : null;

  if (!hasDistribution && !avgZone) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="heart-outline" size={15} color={C.primary} />
        <Text style={styles.headerText}>HEART-RATE ZONES</Text>
      </View>

      {hasDistribution ? (
        <>
          <View style={styles.bar}>
            {zones.map((z) =>
              z.pct > 0 ? (
                <View key={z.key} style={{ width: `${z.pct}%`, backgroundColor: z.color, height: 14 }} />
              ) : null,
            )}
          </View>
          <View style={styles.legend}>
            {zones.map((z) => (
              <View key={z.key} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: z.color }]} />
                <Text style={styles.legendLabel}>{z.label}</Text>
                <Text style={styles.legendPct}>{z.pct}%</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.avgRow}>
          <View style={[styles.dot, { backgroundColor: avgZone.color, width: 12, height: 12, borderRadius: 6 }]} />
          <Text style={styles.avgText}>
            Average effort: <Text style={{ color: avgZone.color, fontWeight: '800' }}>{avgZone.label}</Text>
            {avgBpm ? `  (${Math.round(avgBpm)} bpm)` : ''}
          </Text>
        </View>
      )}
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    card: { backgroundColor: C.cardBackground, borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: C.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    headerText: { color: C.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: C.cardBackgroundLight },
    legend: { marginTop: 10, gap: 4 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { color: C.textSecondary, fontSize: 13, flex: 1 },
    legendPct: { color: C.textPrimary, fontSize: 13, fontWeight: '800' },
    avgRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avgText: { color: C.textSecondary, fontSize: 13, flex: 1 },
  });
  s._colors = C;
  return s;
};

export default HeartRateZones;
