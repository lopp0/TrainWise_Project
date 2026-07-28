import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #183 — Injury-Risk Gauge. A 0-100 semicircular gauge (green/amber/red) driven
 * by computeInjuryRisk (ACWR + Foster monotony/strain). Semantic band colors are
 * fixed across themes; the track + text follow the theme.
 *
 * props: { risk }  // output of utils/injuryRisk.computeInjuryRisk
 */
const W = 200;
const STROKE = 18;
const R = (W - STROKE) / 2;
const CX = W / 2;
const CY = R + STROKE / 2;
const H = R + STROKE;

const BAND_COLORS = { green: '#00e676', amber: '#ff9800', red: '#f44336' };

// Point on the top semicircle at angle deg (180 = left, 0 = right).
const pt = (deg) => {
  const rad = (Math.PI / 180) * deg;
  return [CX + R * Math.cos(rad), CY - R * Math.sin(rad)];
};
const arc = (fromDeg, toDeg) => {
  const [x1, y1] = pt(fromDeg);
  const [x2, y2] = pt(toDeg);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
};

const RiskGauge = ({ risk }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;

  const known = risk && risk.score != null;
  const frac = known ? Math.max(0, Math.min(1, risk.score / 100)) : 0;
  const endDeg = 180 * (1 - frac);
  const color = known ? BAND_COLORS[risk.band] || C.textMuted : C.textMuted;
  const bandLabel = known
    ? risk.band === 'green' ? 'Low risk' : risk.band === 'amber' ? 'Elevated' : 'High risk'
    : 'Not enough data';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="shield-half-outline" size={15} color={C.primary} />
        <Text style={styles.headerText}>INJURY RISK</Text>
      </View>

      <View style={styles.gaugeWrap}>
        <Svg width={W} height={H}>
          <Path d={arc(180, 0)} stroke={C.cardBackgroundLight} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          {known && frac > 0 && (
            <Path d={arc(180, endDeg)} stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          )}
        </Svg>
        <View style={styles.centerOverlay} pointerEvents="none">
          <Text style={[styles.score, { color }]}>{known ? risk.score : '--'}</Text>
          <Text style={[styles.bandLabel, { color }]}>{bandLabel}</Text>
        </View>
      </View>

      {known && (
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>ACWR {risk.ratio != null ? risk.ratio.toFixed(2) : '--'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>Monotony {risk.monotony != null ? risk.monotony.toFixed(1) : '--'}</Text>
        </View>
      )}
      <Text style={styles.tip}>{risk?.tip || 'Log a few sessions this week for a risk read.'}</Text>
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    // Matches the shared <Card> rhythm exactly (no top margin, 16 below) so the
    // gaps above and below this gauge equal every other block on the Load tab.
    // It used to add marginTop:14 ON TOP of the parent's margins, which stacked
    // into a 46px gap above and 0 below (device-test #5).
    card: {
      backgroundColor: C.cardBackground,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: C.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    headerText: { color: C.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    gaugeWrap: { width: W, height: H, alignSelf: 'center', justifyContent: 'flex-end', marginTop: 6 },
    centerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
    score: { fontSize: 40, fontWeight: '900', lineHeight: 44 },
    bandLabel: { fontSize: 13, fontWeight: '800', marginTop: -2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
    metaText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
    metaDot: { color: C.textMuted, fontSize: 12 },
    tip: { color: C.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  });
  s._colors = C;
  return s;
};

export default RiskGauge;
