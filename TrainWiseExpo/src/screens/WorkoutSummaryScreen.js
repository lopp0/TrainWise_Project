import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {Colors, Fonts, Spacing} from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import HeartRateZones from '../components/HeartRateZones';
import { ageFromBirthYear, maxHrForAge } from '../utils/hrZones';
import { useAuth } from '../api/AuthContext';
import { getActivityLogsByUser, shareWorkout } from '../services/api';

const WorkoutSummaryScreen = ({navigation, route}) => {
  const styles = useThemedStyles(makeStyles);
  const { userId, user } = useAuth();
  // Still needed for the share deep-link (#181) — you can only share your own.
  const logId = route?.params?.logId ?? route?.params?.summary?.activityId ?? null;
  const ownerId = route?.params?.ownerId ?? null;
  const isOwnWorkout = ownerId == null || ownerId === userId;

  const [sharing, setSharing] = useState(false); // #181

  // #181 — mark the workout shareable, then open the OS share sheet with the
  // deep link (trainwiseexpo://workout/{id}).
  const handleShare = async () => {
    if (!logId || sharing) return;
    setSharing(true);
    try {
      await shareWorkout(logId, true);
      const url = `trainwiseexpo://workout/${logId}`;
      await Share.share({
        message: `Check out my ${summary.activityName || 'workout'} on TrainWise 💪 ${url}`,
        url,
      });
    } catch (e) {
      Alert.alert('Could not share', e?.response?.data || e?.message || 'Try again.');
    } finally {
      setSharing(false);
    }
  };

  const [avgHr, setAvgHr] = useState(null); // #122

  // #122 — average heart rate for the zone indicator. Prefer HR already on the
  // summary; otherwise look it up from the log by id (best-effort).
  useEffect(() => {
    const s = route?.params?.summary || {};
    const sAvg = s.avgHeartRate ?? s.avgHr ?? null;
    if (sAvg) { setAvgHr(Number(sAvg)); return; }
    if (!logId || !userId) return;
    let alive = true;
    (async () => {
      try {
        const res = await getActivityLogsByUser(userId);
        const rows = Array.isArray(res.data) ? res.data : [];
        const match = rows.find((l) => (l.activityID ?? l.ActivityID) === logId);
        const hr = match ? (match.avgHeartRate ?? match.AvgHeartRate ?? null) : null;
        if (alive && hr) setAvgHr(Number(hr));
      } catch {
        // best-effort — the HR card just stays hidden
      }
    })();
    return () => { alive = false; };
  }, [logId, userId, route?.params?.summary]);

  const maxHr = maxHrForAge(ageFromBirthYear(user?.birthYear ?? user?.BirthYear));

  const summary = route?.params?.summary || {
    activityName: 'Running',
    duration: 45,
    exertion: 7,
    sessionLoad: 315,
    loadLevel: 'Green',
    acuteLoad: 1200,
    chronicLoad: 1100,
    acRatio: 1.09,
    stressScore: 55,
    recommendation: 'Good balanced session. Keep your current rhythm.',
  };

  const getLevelColor = (level) => {
    if (level === 'Red') return Colors.red;
    if (level === 'Yellow') return Colors.yellow;
    return Colors.green;
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Workout Summary"
        subtitle="Your session results"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Session Info */}
        <Card>
          <Text style={styles.cardTitle}>Session Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Activity</Text>
            <Text style={styles.value}>{summary.activityName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.value}>{summary.duration} min</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Exertion</Text>
            <Text style={styles.value}>{summary.exertion}/10</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Session Load</Text>
            <Text style={styles.valuePrimary}>{summary.sessionLoad}</Text>
          </View>
        </Card>

        {/* Load Level */}
        <Card>
          <Text style={styles.cardTitle}>Load Assessment</Text>
          <View style={styles.levelContainer}>
            <View
              style={[
                styles.levelBadge,
                {backgroundColor: getLevelColor(summary.loadLevel)},
              ]}>
              <Text style={styles.levelText}>{summary.loadLevel}</Text>
            </View>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Acute Load</Text>
              <Text style={styles.metricValue}>
                {summary.acuteLoad != null ? Math.round(summary.acuteLoad) : '—'}
              </Text>
              <Text style={styles.metricSub}>7-day</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Chronic Load</Text>
              <Text style={styles.metricValue}>
                {summary.chronicLoad != null ? Math.round(summary.chronicLoad) : '—'}
              </Text>
              <Text style={styles.metricSub}>28-day</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>AC Ratio</Text>
              <Text style={styles.metricValue}>
                {summary.acRatio != null ? Number(summary.acRatio).toFixed(2) : '—'}
              </Text>
              <Text style={styles.metricSub}>acute/chronic</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Stress</Text>
              <Text style={styles.metricValue}>{summary.stressScore}</Text>
              <Text style={styles.metricSub}>0-100</Text>
            </View>
          </View>
        </Card>

        {/* #122 — heart-rate zone (average effort from HR + age) */}
        {avgHr && maxHr ? (
          <View style={{ marginHorizontal: Spacing.lg }}>
            <HeartRateZones avgBpm={avgHr} maxHr={maxHr} />
          </View>
        ) : null}

        {/* Recommendation */}
        <Card>
          <Text style={styles.cardTitle}>Recommendation</Text>
          <Text style={styles.recommendationText}>{summary.recommendation}</Text>
        </Card>

        {/* #181 — share this workout via a deep link */}
        {logId && isOwnWorkout && (
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.85}
          >
            {sharing ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
                <Text style={styles.shareBtnText}>Share this workout</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Kudos (#171) and per-workout Notes & Photo (#124) were REMOVED
            2026-07-19 by request. */}

      </ScrollView>

      <View style={styles.bottomActions}>
        <PrimaryButton
          title="Back to Dashboard"
          onPress={() => navigation.navigate('Warnings')}
        />
        {/* "Log Another Workout" removed 2026-07-19 by request. */}
      </View>
    </View>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  valuePrimary: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
  },
  levelContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  levelBadge: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 30,
  },
  levelText: {
    color: '#000',
    fontSize: 22,
    fontWeight: Fonts.bold,
    letterSpacing: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  metric: {
    width: '48%',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: Fonts.bold,
    marginTop: Spacing.xs,
  },
  metricSub: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  recommendationText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    lineHeight: 22,
  },
  // #181 share
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  shareBtnText: { color: Colors.primary, fontSize: Fonts.bodySize, fontWeight: '800' },
  // Kudos (#171) + Notes/Photo (#124) styles removed 2026-07-19 with the feature.
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
});

export default WorkoutSummaryScreen;
