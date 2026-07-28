import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { getRehabTips, REHAB_DISCLAIMER } from '../utils/rehabTips';

/**
 * #126 — Rehab / recovery suggestions per injury. Foldable list of self-care
 * pointers for the injury type (from utils/rehabTips). Educational only, shown
 * with a disclaimer.
 *
 * props: { injuryTypeId, defaultOpen }
 */
const RehabSuggestions = ({ injuryTypeId, defaultOpen = false }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const [open, setOpen] = useState(defaultOpen);
  const { tips } = getRehabTips(injuryTypeId);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.header} activeOpacity={0.8} onPress={toggle}>
        <View style={styles.headerLeft}>
          <Ionicons name="medkit-outline" size={16} color={C.primary} />
          <Text style={styles.headerText}>Recovery tips</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.primary} />
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {tips.map((t, i) => (
            <View key={i} style={styles.tipRow}>
              <Ionicons name="ellipse" size={6} color={C.primary} style={styles.bullet} />
              <Text style={styles.tipText}>{t}</Text>
            </View>
          ))}
          <Text style={styles.disclaimer}>{REHAB_DISCLAIMER}</Text>
        </View>
      )}
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    wrap: { marginTop: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerText: { color: C.primary, fontSize: 13, fontWeight: '800' },
    body: { marginTop: 8 },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
    bullet: { marginTop: 6 },
    tipText: { color: C.textSecondary, fontSize: 13, lineHeight: 18, flex: 1 },
    disclaimer: { color: C.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  });
  s._colors = C;
  return s;
};

export default RehabSuggestions;
