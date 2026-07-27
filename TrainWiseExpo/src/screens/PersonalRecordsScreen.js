import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../api/AuthContext';
import { getRecords, getActivityLogsByUser, getAllActivityTypes } from '../services/api';
import { parseServerDate } from '../utils/serverDate';
import { BADGE_DEFS, findBadgeDef, METRIC_DEFS, METRIC_ORDER } from '../utils/badges';
import { computePersonalBests, formatPace } from '../utils/personalBests';
import { shareProgressReport } from '../utils/progressReport';
import { shareAchievement } from '../utils/shareAchievement';

const PersonalRecordsScreen = ({ navigation }) => {
  const { userId, user } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [sharingReport, setSharingReport] = useState(false); // #137

  const onShareReport = async () => {
    if (sharingReport) return;
    setSharingReport(true);
    try {
      await shareProgressReport(userId, user?.fullName || 'Athlete');
    } catch (e) {
      Alert.alert('Could not share', e?.message || 'Please try again.');
    } finally {
      setSharingReport(false);
    }
  };
  const [records, setRecords] = useState([]);
  const [badges, setBadges] = useState([]);
  const [activityBests, setActivityBests] = useState([]); // #165
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
    }
    // #165 — per-activity bests, computed client-side from the logs.
    try {
      const [logsRes, typesRes] = await Promise.all([
        getActivityLogsByUser(userId),
        getAllActivityTypes(),
      ]);
      setActivityBests(computePersonalBests(logsRes.data || [], typesRes.data || []));
    } catch (e) {
      console.warn('[PersonalRecords] activity bests failed:', e.message);
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
          {/* #137 — share a progress report (HTML → print to PDF). */}
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={onShareReport}
            disabled={sharingReport}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Share progress report"
          >
            {sharingReport ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Ionicons name="share-outline" size={18} color={Colors.primary} />
            )}
            <Text style={styles.reportBtnText}>Share progress report</Text>
          </TouchableOpacity>

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

          {/* #165 — per-activity bests */}
          {activityBests.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>BY ACTIVITY</Text>
              {activityBests.map((a) => {
                const pace = formatPace(a.bestPaceMinPerKm);
                return (
                  <View key={a.typeId} style={styles.actCard}>
                    <View style={styles.actHeader}>
                      <Text style={styles.actName}>{a.typeName}</Text>
                      <Text style={styles.actSessions}>{a.sessions} {a.sessions === 1 ? 'session' : 'sessions'}</Text>
                    </View>
                    <View style={styles.actStatsRow}>
                      <View style={styles.actStat}>
                        <Text style={styles.actStatVal}>{a.longestDurationMin}m</Text>
                        <Text style={styles.actStatLabel}>Longest</Text>
                      </View>
                      {a.longestDistanceKm > 0 && (
                        <View style={styles.actStat}>
                          <Text style={styles.actStatVal}>{a.longestDistanceKm} km</Text>
                          <Text style={styles.actStatLabel}>Distance</Text>
                        </View>
                      )}
                      {pace && (
                        <View style={styles.actStat}>
                          <Text style={styles.actStatVal}>{pace}</Text>
                          <Text style={styles.actStatLabel}>Best pace</Text>
                        </View>
                      )}
                      <View style={styles.actStat}>
                        <Text style={styles.actStatVal}>{a.topLoad}</Text>
                        <Text style={styles.actStatLabel}>Top load</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* Badges */}
          <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>
            BADGES · {badges.length}/{BADGE_DEFS.length}
          </Text>
          <View style={styles.badgeGrid}>
            {BADGE_DEFS.map((b) => {
              const earned = earnedMap[b.key];
              const earnedDate = earned ? parseServerDate(earned) : null;
              // #172 — tap an EARNED badge to share it via the OS share sheet.
              const Wrapper = earned ? TouchableOpacity : View;
              return (
                <Wrapper
                  key={b.key}
                  style={[styles.badgeCard, !earned && styles.badgeCardLocked]}
                  {...(earned
                    ? {
                        activeOpacity: 0.85,
                        onPress: () => shareAchievement({ title: b.label, detail: b.hint }),
                        accessibilityRole: 'button',
                        accessibilityLabel: `Share achievement ${b.label}`,
                      }
                    : {})}
                >
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
                  {earned && <Ionicons name="share-social-outline" size={12} color={Colors.primary} style={styles.badgeShareIcon} />}
                </Wrapper>
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

  reportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.cardBackground, borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: C.border, marginBottom: Spacing.lg,
  },
  reportBtnText: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },

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

  actCard: {
    backgroundColor: C.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  actHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  actName: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  actSessions: { color: C.textMuted, fontSize: 12, fontWeight: '700' },
  actStatsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  actStat: { minWidth: '25%', marginBottom: 4 },
  actStatVal: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  actStatLabel: { color: C.textMuted, fontSize: 11, marginTop: 1 },

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
  badgeShareIcon: { position: 'absolute', top: 6, right: 6 },
});

export default PersonalRecordsScreen;
