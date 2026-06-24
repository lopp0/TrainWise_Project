import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import ActivityIcon from './ActivityIcon';
import { computeWeeklySummary } from '../utils/weeklyStats';

/**
 * B-8 — collapsible "This week at a glance" card placed under the Home
 * dashboard. All values are derived from the confirmed ActivityLogs already
 * fetched by HomeScreen (passed in as `logs`); it never makes its own API call.
 * Default state is expanded; collapses with the same LayoutAnimation chevron
 * pattern used by the Connect/AddWorkout collapsible cards.
 */
// Module-level sub-component receives `styles` as a prop (it can't close over
// the component-scoped themed styles otherwise — see lessons 2026-05-31).
const Stat = ({ icon, value, label, valueColor, styles }) => (
  <View style={styles.statBox}>
    <View style={styles.statIconRow}>{icon}</View>
    <Text style={[styles.statValue, valueColor && { color: valueColor }]} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.statLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const WeeklySummaryCard = ({ logs, activityTypes }) => {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false); // collapsed by default
  const summary = useMemo(
    () => computeWeeklySummary(logs, activityTypes),
    [logs, activityTypes]
  );

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  const deltaColor =
    summary.deltaPct == null ? styles._muted : summary.deltaPct >= 0 ? '#00e676' : '#ff9800';
  const deltaText =
    summary.deltaPct == null ? '—' : `${summary.deltaPct >= 0 ? '+' : ''}${summary.deltaPct}%`;

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} activeOpacity={0.8} onPress={toggle}>
        <View style={styles.headerLeft}>
          <Ionicons name="stats-chart" size={16} color={styles._primary} />
          <Text style={styles.headerTitle}>THIS WEEK AT A GLANCE</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={styles._primary} />
      </TouchableOpacity>

      {open &&
        (!summary.hasData ? (
          <Text style={styles.empty}>No workouts logged this week yet.</Text>
        ) : (
          <View style={styles.grid}>
            <Stat
              styles={styles}
              icon={<Ionicons name="barbell" size={18} color={styles._primary} />}
              value={String(summary.sessions)}
              label="Sessions"
            />
            <Stat
              styles={styles}
              icon={<Ionicons name="pulse" size={18} color={styles._primary} />}
              value={String(summary.totalLoad)}
              label="Total load"
            />
            <Stat
              styles={styles}
              icon={
                summary.longest && (summary.longest.activityTypeId != null || summary.longest.typeName) ? (
                  <ActivityIcon
                    activityTypeId={summary.longest.activityTypeId}
                    typeName={summary.longest.typeName}
                    size={18}
                  />
                ) : (
                  <Ionicons name="time" size={18} color={styles._primary} />
                )
              }
              value={summary.longest ? `${summary.longest.duration}m` : '—'}
              label={summary.longest?.typeName ? `Longest · ${summary.longest.typeName}` : 'Longest'}
            />
            <Stat
              styles={styles}
              icon={
                summary.mostFrequent ? (
                  <ActivityIcon
                    activityTypeId={summary.mostFrequent.activityTypeId}
                    typeName={summary.mostFrequent.typeName}
                    size={18}
                  />
                ) : (
                  <Ionicons name="repeat" size={18} color={styles._primary} />
                )
              }
              value={summary.mostFrequent ? `×${summary.mostFrequent.count}` : '—'}
              label={summary.mostFrequent?.typeName ? `Top · ${summary.mostFrequent.typeName}` : 'Top activity'}
            />
            <Stat
              styles={styles}
              icon={<Ionicons name="flame" size={18} color="#ff7a00" />}
              value={String(summary.streak)}
              label="Day streak"
            />
            <Stat
              styles={styles}
              icon={
                <Ionicons
                  name={summary.deltaPct == null ? 'remove' : summary.deltaPct >= 0 ? 'trending-up' : 'trending-down'}
                  size={18}
                  color={deltaColor}
                />
              }
              value={deltaText}
              valueColor={deltaColor}
              label="vs last week"
            />
          </View>
        ))}
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    card: {
      backgroundColor: Colors.cardBackground,
      borderRadius: 14,
      padding: 16,
      // No horizontal margin: HomeScreen's ScrollView already pads 16 so the
      // card lines up with the chart / Add-Workout cards above it (item 2).
      marginTop: 14,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    headerTitle: {
      color: Colors.primary,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    empty: {
      color: Colors.textSecondary,
      fontSize: 13,
      marginTop: 12,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    statBox: {
      width: '48%',
      backgroundColor: Colors.background,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 10,
      marginBottom: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
    },
    statIconRow: { height: 22, justifyContent: 'center' },
    statValue: {
      color: Colors.textPrimary,
      fontSize: 19,
      fontWeight: '800',
      marginTop: 2,
    },
    statLabel: {
      color: Colors.textSecondary,
      fontSize: 11,
      marginTop: 2,
      textAlign: 'center',
    },
  });
  s._primary = Colors.primary;
  s._muted = Colors.textMuted;
  return s;
};

export default WeeklySummaryCard;
