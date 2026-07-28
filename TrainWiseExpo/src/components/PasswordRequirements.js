import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { passwordChecks } from '../utils/validation';

/**
 * Live password-requirement checklist. Each rule turns green with a checkmark as
 * the user satisfies it. Hidden until the user starts typing (empty password).
 *
 * props: { password }
 */
const PasswordRequirements = ({ password = '' }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  if (!password) return null;
  const checks = passwordChecks(password);
  return (
    <View style={styles.wrap}>
      {checks.map((c) => (
        <View key={c.key} style={styles.row}>
          <Ionicons
            name={c.ok ? 'checkmark-circle' : 'ellipse-outline'}
            size={14}
            color={c.ok ? C.success : C.textMuted}
          />
          <Text style={[styles.label, c.ok && { color: C.success }]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    wrap: { width: '100%', marginTop: 8, gap: 3 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    label: { color: C.textSecondary, fontSize: 12 },
  });
  s._colors = C;
  return s;
};

export default PasswordRequirements;
