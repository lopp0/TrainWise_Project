import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * A-3 — segmented control switching the Connect tab between the discovery Map,
 * the community Board, and the Leaderboard. Each is a separate screen in
 * ConnectStack; tapping navigates (back to an existing instance if already in
 * the stack).
 */
const TABS = [
  ['map', 'Map', 'map-outline', 'ConnectMain'],
  ['board', 'Board', 'newspaper-outline', 'WorkoutBoard'],
  ['leaderboard', 'Ranks', 'trophy-outline', 'Leaderboard'],
];

const ConnectTabs = ({ active, navigation }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      {TABS.map(([key, label, icon, route]) => {
        const on = active === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.tab, on && styles.tabActive]}
            onPress={() => {
              if (!on) navigation.navigate(route);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name={icon} size={16} color={on ? '#fff' : styles._sec} />
            <Text style={[styles.tabText, on && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: Colors.cardBackground,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
    tabTextActive: { color: '#fff' },
  });
  s._sec = Colors.textSecondary;
  return s;
};

export default ConnectTabs;
