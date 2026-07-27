import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Rect, Ellipse } from 'react-native-svg';
import { useThemedStyles } from '../theme/useThemedStyles';
import { FRONT_REGIONS, BACK_REGIONS } from '../utils/bodyRegions';

/**
 * #125 — Body-map injury picker. Front/back stylized silhouette with tappable
 * regions; tapping a region reports the matching InjuryTypeID to the parent
 * (which preselects it in the report form). Touch is handled by transparent
 * overlay views (reliable on the New Architecture) sized from the SVG viewBox.
 *
 * props: { selectedInjuryTypeId, onSelect(injuryTypeId, label) }
 */
const VW = 120;
const VH = 300;
const SCALE = 1.25;
const W = VW * SCALE;
const H = VH * SCALE;

const BodyMapPicker = ({ selectedInjuryTypeId, onSelect }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const [view, setView] = useState('front');
  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;

  const bodyFill = C.cardBackgroundLight;
  const bodyStroke = C.border;

  return (
    <View>
      <View style={styles.toggleRow}>
        {['front', 'back'].map((v) => {
          const active = view === v;
          return (
            <TouchableOpacity
              key={v}
              style={[styles.toggleBtn, active && styles.toggleBtnActive]}
              onPress={() => setView(v)}
              activeOpacity={0.85}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                {v === 'front' ? 'Front' : 'Back'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ width: W, height: H, alignSelf: 'center' }}>
        <Svg width={W} height={H} viewBox={`0 0 ${VW} ${VH}`}>
          {/* Stylized silhouette (decorative) */}
          <Circle cx={60} cy={24} r={14} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
          <Rect x={42} y={38} width={36} height={78} rx={14} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
          <Rect x={22} y={46} width={13} height={100} rx={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
          <Rect x={85} y={46} width={13} height={100} rx={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
          <Rect x={42} y={112} width={36} height={22} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
          <Rect x={44} y={132} width={13} height={160} rx={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
          <Rect x={63} y={132} width={13} height={160} rx={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />

          {/* Region markers */}
          {regions.map((r) => {
            const selected = selectedInjuryTypeId === r.injuryTypeId;
            return (
              <Ellipse
                key={r.key}
                cx={r.cx}
                cy={r.cy}
                rx={r.rx}
                ry={r.ry}
                fill={selected ? C.primary : C.primary}
                fillOpacity={selected ? 0.85 : 0.18}
                stroke={selected ? '#fff' : C.primary}
                strokeWidth={selected ? 1.5 : 0.8}
              />
            );
          })}
        </Svg>

        {/* Transparent touch overlays (reliable hit-testing) */}
        {regions.map((r) => (
          <TouchableOpacity
            key={r.key}
            activeOpacity={0.6}
            onPress={() => onSelect?.(r.injuryTypeId, r.label)}
            style={{
              position: 'absolute',
              left: (r.cx - r.rx - 3) * SCALE,
              top: (r.cy - r.ry - 3) * SCALE,
              width: (r.rx * 2 + 6) * SCALE,
              height: (r.ry * 2 + 6) * SCALE,
            }}
          />
        ))}
      </View>

      <Text style={styles.hint}>Tap where it hurts to preselect the injury type.</Text>
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    toggleRow: { flexDirection: 'row', alignSelf: 'center', backgroundColor: C.inputBackground, borderRadius: 10, padding: 4, marginBottom: 8 },
    toggleBtn: { paddingVertical: 6, paddingHorizontal: 22, borderRadius: 8 },
    toggleBtnActive: { backgroundColor: C.primary },
    toggleText: { color: C.textSecondary, fontSize: 13, fontWeight: '800' },
    toggleTextActive: { color: '#fff' },
    hint: { color: C.textMuted, fontSize: 12, textAlign: 'center', marginTop: 6 },
  });
  s._colors = C;
  return s;
};

export default BodyMapPicker;
