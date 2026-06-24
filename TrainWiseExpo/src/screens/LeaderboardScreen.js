import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../api/AuthContext';
import { getLeaderboard, setLeaderboardOptIn } from '../services/api';
import UserProfileCard from '../components/UserProfileCard';
import ConnectTabs from '../components/ConnectTabs';
import { experienceLabel } from '../utils/experience';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

// All four metrics are computed over the last 7 days (item 10).
const METRICS = [
  ['load_weekly', 'Load'],
  ['distance_total', 'Distance'],
  ['duration_total', 'Duration'],
  ['calories_total', 'Calories'],
];

const OPTIN_KEY = '@trainwise_leaderboard_optin';

const formatMetric = (metric, v) => {
  const n = Number(v) || 0;
  switch (metric) {
    case 'distance_total': return `${n.toFixed(1)} km`;
    case 'duration_total': return `${Math.round(n)} min`;
    case 'calories_total': return `${Math.round(n)} kcal`;
    case 'load_weekly':
    default: return `${Math.round(n)}`;
  }
};

const rankBadge = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`);

const LeaderboardScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('load_weekly');
  const [optIn, setOptIn] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(OPTIN_KEY).then((v) => setOptIn(v !== '0'));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLeaderboard({ country: 'IL', metric, limit: 50 });
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [metric]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleOptIn = async (value) => {
    setOptIn(value);
    await AsyncStorage.setItem(OPTIN_KEY, value ? '1' : '0');
    try {
      await setLeaderboardOptIn(userId, value);
    } catch {}
    load();
  };

  const renderRow = ({ item }) => {
    const rank = item.rank ?? item.Rank;
    const author = {
      fullName: item.fullName ?? item.FullName,
      profileImagePath: item.profileImagePath ?? item.ProfileImagePath,
      equippedBadge: item.equippedBadge ?? item.EquippedBadge,
      equippedTitle: item.equippedTitle ?? item.EquippedTitle,
      equippedFrame: item.equippedFrame ?? item.EquippedFrame,
    };
    const mine = (item.userID ?? item.UserID) === userId;
    return (
      <View style={[styles.row, mine && styles.rowMine]}>
        <Text style={[styles.rank, rank <= 3 && styles.rankTop]}>{rankBadge(rank)}</Text>
        <View style={{ flex: 1 }}>
          <UserProfileCard
            user={author}
            size={40}
            subtitle={experienceLabel(item.experienceLevel ?? item.ExperienceLevel)}
          />
        </View>
        <Text style={styles.metricValue}>{formatMetric(metric, item.metricValue ?? item.MetricValue)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Top athletes in your country · this week</Text>
      </View>
      <ConnectTabs active="leaderboard" navigation={navigation} />

      {/* Metric chips */}
      <View style={styles.chipRow}>
        {METRICS.map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.chip, metric === key && styles.chipActive]}
            onPress={() => setMetric(key)}
          >
            <Text style={[styles.chipText, metric === key && styles.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Opt-in */}
      <View style={styles.optInRow}>
        <Text style={styles.optInLabel}>Include me in the leaderboard</Text>
        <Switch
          value={optIn}
          onValueChange={toggleOptIn}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor="#fff"
        />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e, i) => String((e.userID ?? e.UserID) ?? i)}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>No ranked athletes yet for this metric.</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  title: { color: C.primary, fontSize: 28, fontWeight: '900', fontStyle: 'italic' },
  subtitle: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.cardBackground,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  optInRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 6,
  },
  optInLabel: { color: C.textSecondary, fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.cardBackground, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  rowMine: { borderColor: C.primary },
  rank: { color: C.textSecondary, fontSize: 16, fontWeight: '900', width: 34, textAlign: 'center' },
  rankTop: { fontSize: 20 },
  metricValue: { color: C.textPrimary, fontSize: 15, fontWeight: '900' },
});

export default LeaderboardScreen;
