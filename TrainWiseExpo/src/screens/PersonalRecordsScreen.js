import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../api/AuthContext';
import { getRecords } from '../services/api';
import { parseServerDate } from '../utils/serverDate';
import { BADGE_DEFS, findBadgeDef, METRIC_DEFS, METRIC_ORDER } from '../utils/badges';

const PersonalRecordsScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [records, setRecords] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getRecords(userId);
      setRecords(res.data?.records || res.data?.Records || []);
      setBadges(res.data?.badges || res.data?.Badges || []);
    } catch (e) {
      console.warn('[PersonalRecords] load failed:', e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const recordFor = (metric) =>
    records.find((r) => (r.metricType ?? r.MetricType) === metric) || null;

  const earnedMap = {};
  badges.forEach((b) => {
    earnedMap[b.badgeKey ?? b.BadgeKey] = b.earnedAt ?? b.EarnedAt;
  });

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Personal Records"
        subtitle="Your bests + achievement badges"
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Records */}
          <Text style={styles.sectionTitle}>RECORDS</Text>
          <View style={styles.recordsGrid}>
            {METRIC_ORDER.map((metric) => {
              const def = METRIC_DEFS[metric];
              const rec = recordFor(metric);
              const value = rec ? def.fmt(rec.recordValue ?? rec.RecordValue) : '—';
              const date = rec ? parseServerDate(rec.achievedAt ?? rec.AchievedAt) : null;
              return (
                <View key={metric} style={styles.recordCard}>
                  <Ionicons name={def.icon} size={22} color={Colors.primary} />
                  <Text style={styles.recordValue}>{value}</Text>
                  <Text style={styles.recordLabel} numberOfLines={1}>
                    {def.label}
                  </Text>
                  {date && (
                    <Text style={styles.recordDate}>{date.toLocaleDateString()}</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Badges */}
          <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>
            BADGES · {badges.length}/{BADGE_DEFS.length}
          </Text>
          <View style={styles.badgeGrid}>
            {BADGE_DEFS.map((b) => {
              const earned = earnedMap[b.key];
              const earnedDate = earned ? parseServerDate(earned) : null;
              return (
                <View key={b.key} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                  <View
                    style={[styles.badgeIconWrap, earned ? styles.badgeIconEarned : styles.badgeIconLocked]}
                  >
                    <Ionicons
                      name={b.icon}
                      size={24}
                      color={earned ? '#fff' : Colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]} numberOfLines={1}>
                    {b.label}
                  </Text>
                  <Text style={styles.badgeHint} numberOfLines={2}>
                    {earned && earnedDate ? earnedDate.toLocaleDateString() : b.hint}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },
  sectionTitle: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: Spacing.md,
  },

  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  recordCard: {
    width: '48%',
    backgroundColor: C.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  recordValue: { color: C.textPrimary, fontSize: 22, fontWeight: '900', marginTop: 6 },
  recordLabel: { color: C.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  recordDate: { color: C.textMuted, fontSize: 10, marginTop: 2 },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  badgeCard: {
    width: '31%',
    backgroundColor: C.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: 6,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  badgeCardLocked: { opacity: 0.65 },
  badgeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  badgeIconEarned: { backgroundColor: C.primary },
  badgeIconLocked: { backgroundColor: C.cardBackgroundLight },
  badgeLabel: { color: C.textPrimary, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  badgeLabelLocked: { color: C.textSecondary },
  badgeHint: { color: C.textMuted, fontSize: 9, textAlign: 'center', marginTop: 2 },
});

export default PersonalRecordsScreen;
