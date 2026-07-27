import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { getPublicWorkout } from '../services/api';
import { parseServerDate } from '../utils/serverDate';

/**
 * #181 — read-only view of a workout opened via a share deep link
 * (trainwiseexpo://workout/{id}). Fetches only the non-sensitive public
 * projection (no owner identity / heart rate / calories). Shows a friendly
 * "not shared" state on 404.
 */
const SharedWorkoutScreen = ({ route, navigation }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const workoutId = route?.params?.workoutId;
  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getPublicWorkout(workoutId);
        if (alive) setWorkout(res.data);
      } catch (e) {
        if (alive) setError(e?.response?.status === 404
          ? 'This workout is no longer shared.'
          : 'Could not load this workout.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [workoutId]);

  const dateStr = workout
    ? parseServerDate(workout.startTime ?? workout.StartTime)?.toLocaleDateString('en-US', {
        weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Jerusalem',
      })
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shared workout</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={54} color={C.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.badge}>
            <Ionicons name="share-social" size={26} color="#fff" />
          </View>
          <Text style={styles.activity}>{workout.activityName ?? workout.ActivityName}</Text>
          <Text style={styles.date}>{dateStr}</Text>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricVal}>{workout.duration ?? workout.Duration}</Text>
              <Text style={styles.metricLabel}>minutes</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricVal}>
                {(workout.distanceKM ?? workout.DistanceKM ?? 0).toFixed
                  ? (workout.distanceKM ?? workout.DistanceKM ?? 0).toFixed(1)
                  : workout.distanceKM ?? workout.DistanceKM ?? 0}
              </Text>
              <Text style={styles.metricLabel}>km</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricVal}>{workout.exertionLevel ?? workout.ExertionLevel}/10</Text>
              <Text style={styles.metricLabel}>exertion</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricVal, { color: C.primary }]}>
                {workout.sessionLoad ?? workout.SessionLoad}
              </Text>
              <Text style={styles.metricLabel}>load</Text>
            </View>
          </View>

          <Text style={styles.footer}>Shared from TrainWise 💪</Text>
        </View>
      )}
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 50,
      paddingBottom: 12,
      paddingHorizontal: 14,
      backgroundColor: C.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    errorText: { color: C.textSecondary, fontSize: 15, marginTop: 14, textAlign: 'center' },
    card: {
      margin: 20,
      backgroundColor: C.cardBackground,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      padding: 24,
    },
    badge: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    activity: { color: C.textPrimary, fontSize: 24, fontWeight: '900' },
    date: { color: C.textMuted, fontSize: 14, marginTop: 4 },
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24, marginTop: 24 },
    metric: { alignItems: 'center', minWidth: 64 },
    metricVal: { color: C.textPrimary, fontSize: 22, fontWeight: '900' },
    metricLabel: { color: C.textMuted, fontSize: 12, marginTop: 2 },
    footer: { color: C.textSecondary, fontSize: 13, marginTop: 26, fontWeight: '600' },
  });
  s._colors = C;
  return s;
};

export default SharedWorkoutScreen;
