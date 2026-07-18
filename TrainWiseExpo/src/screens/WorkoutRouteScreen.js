import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { useThemedStyles } from '../theme/useThemedStyles';
import HealthConnectService from '../api/HealthConnectService';

/**
 * WorkoutRouteScreen
 *
 * Strava-style GPS route map for a cardio workout (running / walking /
 * cycling / hiking / swimming). Reached by tapping "View route" on a
 * cardio row in GoogleFitScreen (the Health tab).
 *
 * Storage strategy = pull-from-Health-Connect-on-view: backend ActivityLog
 * rows don't carry the HC record id, so we re-query Health Connect for the
 * session matching this workout's startTime and resolve its GPS route each
 * time the screen opens. Only HC-sourced workouts can have a route; manual
 * logs and indoor sessions fall back to a "No route recorded" empty state.
 *
 * expo-maps is required-lazily so the screen never crashes if the native
 * module is missing (Expo Go / before the native rebuild) — it degrades to
 * the empty state instead.
 */

// ── Lazy, crash-safe load of expo-maps ─────────────────────────────────────
let GoogleMaps = null;
try {
  GoogleMaps = require('expo-maps').GoogleMaps;
} catch (_e) {
  GoogleMaps = null;
}

const ACTIVITY_NAMES = {
  1: 'Running',
  2: 'Walking',
  3: 'Cycling',
  4: 'Weightlifting',
  5: 'Workout',
};

const formatDate = (isoString) => {
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Jerusalem',
    });
  } catch {
    return '';
  }
};

const formatTime = (isoString) => {
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Jerusalem',
    });
  } catch {
    return '';
  }
};

/**
 * Average pace in min/km from distance + duration. Returns null when either
 * is missing or zero so the stat tile can hide.
 */
const computePace = (distanceKM, durationMin) => {
  if (!distanceKM || distanceKM <= 0 || !durationMin || durationMin <= 0) {
    return null;
  }
  const paceMinPerKm = durationMin / distanceKM;
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  const ss = seconds === 60 ? '00' : String(seconds).padStart(2, '0');
  const mm = seconds === 60 ? minutes + 1 : minutes;
  return `${mm}:${ss}/km`;
};

const WorkoutRouteScreen = ({ navigation, route }) => {
  const styles = useThemedStyles(makeStyles);
  const Colors = styles._colors;
  const workout = route?.params?.workout || {};

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState([]);
  // 'data' | 'no_data' | 'consent_required' | 'unavailable'
  const [status, setStatus] = useState('no_data');

  const activityName = ACTIVITY_NAMES[workout.activityTypeID] || 'Workout';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await HealthConnectService.fetchRouteForWorkout(
          workout.startTime,
          workout.endTime
        );
        if (cancelled) return;
        setPoints(result?.points || []);
        setStatus(result?.status || 'no_data');
      } catch {
        if (!cancelled) {
          setPoints([]);
          setStatus('unavailable');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workout.startTime, workout.endTime]);

  // Camera centered on the route's midpoint. expo-maps fits the polyline
  // best when given a sensible starting center + zoom.
  const cameraPosition = useMemo(() => {
    if (points.length === 0) return null;
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    // Rough zoom from the bounding-box span (degrees) — tighter span = closer.
    const span = Math.max(
      Math.max(...lats) - Math.min(...lats),
      Math.max(...lngs) - Math.min(...lngs)
    );
    let zoom = 14;
    if (span > 0.2) zoom = 10;
    else if (span > 0.1) zoom = 11;
    else if (span > 0.05) zoom = 12;
    else if (span > 0.02) zoom = 13;
    else if (span > 0.005) zoom = 15;
    else zoom = 16;
    return { coordinates: { latitude: centerLat, longitude: centerLng }, zoom };
  }, [points]);

  const distanceKM = workout.distanceKM || 0;
  const durationMin = workout.duration || 0;
  const calories = workout.caloriesBurned || 0;
  const pace = computePace(distanceKM, durationMin);

  const renderStats = () => (
    <View style={styles.statsRow}>
      <Stat styles={styles} icon="time-outline" label="Duration" value={`${durationMin} min`} />
      {distanceKM > 0 && (
        <Stat styles={styles} icon="map-outline" label="Distance" value={`${distanceKM.toFixed(2)} km`} />
      )}
      {pace && <Stat styles={styles} icon="speedometer-outline" label="Pace" value={pace} />}
      {calories > 0 && (
        <Stat styles={styles} icon="flame-outline" label="Calories" value={`${Math.round(calories)}`} />
      )}
    </View>
  );

  const renderMapBody = () => {
    if (loading) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerText}>Loading route…</Text>
        </View>
      );
    }

    const hasRoute = status === 'data' && points.length >= 2;

    if (hasRoute && GoogleMaps?.View) {
      return (
        <GoogleMaps.View
          style={styles.map}
          cameraPosition={cameraPosition || undefined}
          polylines={[
            {
              coordinates: points,
              color: Colors.primary,
              width: 6,
            },
          ]}
          markers={[
            {
              coordinates: points[0],
              title: 'Start',
            },
            {
              coordinates: points[points.length - 1],
              title: 'Finish',
            },
          ]}
        />
      );
    }

    // Empty / fallback states ------------------------------------------------
    let icon = 'map-outline';
    let title = 'No route recorded';
    let subtitle =
      'This workout has no GPS data. Manual and indoor workouts don’t include a route.';

    if (status === 'consent_required') {
      icon = 'lock-closed-outline';
      title = 'Route access needed';
      subtitle =
        'Health Connect needs permission to share this route. Re-open and allow access when prompted.';
    } else if (status === 'unavailable') {
      icon = 'cloud-offline-outline';
      title = 'Map unavailable';
      subtitle =
        'Health Connect isn’t available on this device, or the map module isn’t installed in this build.';
    } else if (hasRoute && !GoogleMaps?.View) {
      icon = 'cloud-offline-outline';
      title = 'Map module not installed';
      subtitle =
        'A GPS route exists for this workout, but the map component isn’t in this build yet. Rebuild the app to view it.';
    } else if (status === 'data' && points.length < 2) {
      title = 'Route too short to map';
      subtitle = 'Only a single GPS point was recorded for this workout.';
    }

    return (
      <View style={styles.centerBox}>
        <Ionicons name={icon} size={56} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={activityName}
        subtitle={`${formatDate(workout.startTime)} • ${formatTime(workout.startTime)}`}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.statsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsScroll}
        >
          {renderStats()}
        </ScrollView>
      </View>
      <View style={styles.mapWrap}>{renderMapBody()}</View>
    </View>
  );
};

const Stat = ({ styles, icon, label, value }) => (
  <View style={styles.statTile}>
    <Ionicons name={icon} size={18} color={styles._colors.primary} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    statsWrap: {
      backgroundColor: Colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    statsScroll: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
    statsRow: { flexDirection: 'row', gap: 10 },
    statTile: {
      alignItems: 'center',
      backgroundColor: Colors.cardBackgroundLight,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minWidth: 84,
    },
    statValue: {
      color: Colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      marginTop: 4,
    },
    statLabel: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
    mapWrap: { flex: 1 },
    map: { flex: 1 },
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    centerText: { color: Colors.textSecondary, marginTop: 12, fontSize: 14 },
    emptyTitle: {
      color: Colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtitle: {
      color: Colors.textSecondary,
      fontSize: 13,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
  // Expose the live palette so child components / JSX can read raw colors
  // (icons, map polyline) without re-importing the mutable singleton.
  s._colors = Colors;
  return s;
};

export default WorkoutRouteScreen;
