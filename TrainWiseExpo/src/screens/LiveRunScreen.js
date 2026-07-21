import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import ScreenHeader from '../components/ScreenHeader';
import ActivityIcon from '../components/ActivityIcon';
import { useAuth } from '../api/AuthContext';
import { createActivityLog, calculateDailyLoad } from '../services/api';
import { markWorkoutToday } from '../api/NotificationService';
import { startLiveTracking, stopLiveTracking, readLiveBuffer, clearLiveBuffer } from '../utils/liveTracking';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #121 — Live GPS run tracking. Records the user's OWN outdoor route and, on
 * finish, saves a normal ActivityLog (distance + duration + load) + the polyline
 * to AsyncStorage (keyed by log id) so WorkoutRouteScreen can redraw it.
 *
 * BACKGROUND tracking (Samsung-Health style): the actual location updates run in
 * a foreground-service task (utils/liveTracking.js) that keeps recording when
 * the screen is off or the app is backgrounded. This screen just POLLS the
 * task's point buffer to draw the live route. Needs expo-task-manager + the
 * background/foreground-service permissions (added 2026-07-21) → native rebuild.
 */

// Lazy, crash-safe expo-maps load (same pattern as WorkoutRouteScreen).
let GoogleMaps = null;
try { GoogleMaps = require('expo-maps').GoogleMaps; } catch (_e) { GoogleMaps = null; }

// Every OUTDOOR activity that produces a map route needs the GPS tracker (seed
// ActivityTypeIDs). Icons + identity colors come from the shared ActivityIcon
// mapping so they match the rest of the app.
const TRACK_ACTIVITIES = [
  { id: 1, label: 'Run' },
  { id: 2, label: 'Walk' },
  { id: 3, label: 'Cycle' },
  { id: 7, label: 'Trail' },
  { id: 8, label: 'Hike' },
  { id: 15, label: 'Nordic' },
  { id: 16, label: 'Brisk' },
  { id: 19, label: 'Interval' },
];
// IDs offered here — also the set that shows the "Track route with GPS" entry
// from AddWorkout's live tab.
export const GPS_TRACKABLE_IDS = TRACK_ACTIVITIES.map((a) => a.id);

const ROUTE_KEY = (startIso) => `@trainwise_route_${startIso}`;
const ROUTE_KEY_LOG = (logId) => `@trainwise_route_log_${logId}`;

// Haversine distance (km) between two {latitude, longitude} points.
const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const fmtClock = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const paceStr = (km, sec) => {
  if (!km || km <= 0 || !sec) return '—';
  const perKm = sec / 60 / km; // minutes per km
  const m = Math.floor(perKm);
  const s = Math.round((perKm - m) * 60);
  return `${m}:${String(s === 60 ? 0 : s).padStart(2, '0')}/km`;
};

const LiveRunScreen = ({ navigation, route }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);

  // A preselected activity (e.g. launched from the live-workout screen). Falls
  // back to Run, and clamps to a trackable activity if an indoor one was passed.
  const presetActivity = route?.params?.activityTypeId;
  const initialActivity = TRACK_ACTIVITIES.some((a) => a.id === presetActivity) ? presetActivity : 1;

  const [phase, setPhase] = useState('idle');   // idle | running | paused | review
  const [points, setPoints] = useState([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [activityId, setActivityId] = useState(initialActivity);
  const [exertion, setExertion] = useState(5);
  const [center, setCenter] = useState(null);
  const [saving, setSaving] = useState(false);

  const pollRef = useRef(null);       // foreground buffer poll (draws the live route)
  const timerRef = useRef(null);      // elapsed clock
  const pausedRef = useRef(false);
  const startTimeRef = useRef(null);
  const mountedRef = useRef(true);
  const activeRef = useRef(false);    // true while the tracking service is running
  // Pause windows (epoch ms). Points recorded inside a window are dropped and the
  // route is not connected across the gap, so pausing truly pauses distance.
  const pauseWindowsRef = useRef([]);
  // Wall-clock timing so the clock can't drift or jump when setInterval fires
  // late/bunched (Android throttles timers). elapsed is derived from real time.
  const startEpochRef = useRef(0);
  const pausedAccumMsRef = useRef(0);
  const pauseStartRef = useRef(0);

  // Rebuild the polyline + distance from the buffered points, honouring pauses.
  const buildRoute = useCallback((buf) => {
    const pauses = pauseWindowsRef.current;
    const inPause = (t) => pauses.some((p) => t >= p.start && (p.end == null || t <= p.end));
    const pts = [];
    let dist = 0;
    let prev = null;
    let brokeForPause = false;
    for (const b of buf) {
      if (inPause(b.t)) { brokeForPause = true; continue; }
      const p = { latitude: b.latitude, longitude: b.longitude };
      pts.push(p);
      if (prev && !brokeForPause) {
        const d = haversineKm(prev, p);
        if (d >= 0.003) dist += d;   // jitter filter (skip < 3 m)
      }
      prev = p;
      brokeForPause = false;
    }
    return { pts, dist };
  }, []);

  const refreshFromBuffer = useCallback(async () => {
    const buf = await readLiveBuffer();
    if (!mountedRef.current || !buf.length) return;
    const { pts, dist } = buildRoute(buf);
    setPoints(pts);
    setDistanceKm(dist);
    if (pts.length) setCenter(pts[pts.length - 1]);
  }, [buildRoute]);

  const stopTracking = useCallback(() => {
    activeRef.current = false;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    stopLiveTracking();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Kill the foreground service if the user navigated away mid-run.
      if (activeRef.current) { stopLiveTracking(); clearLiveBuffer(); }
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Show the map at the user's current location immediately (before Start), so
  // the screen isn't a blank box. Only reads position if permission is already
  // granted — Start still requests it if needed.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        let pos = await Location.getLastKnownPositionAsync();
        if (!pos) pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (mountedRef.current && pos?.coords) {
          setCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch { /* leave "Waiting for GPS…" until Start */ }
    })();
  }, []);

  const start = async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      Alert.alert('Location needed', 'Allow location access to track your route.');
      return;
    }
    // Background permission lets tracking continue with the screen off / app in
    // the background (Samsung-Health style). Best-effort: if the user only grants
    // "while using the app", the run still records while the screen is on.
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        Alert.alert(
          'Tip: allow "all the time"',
          'To keep recording with the screen off, set location to "Allow all the time" in settings. Tracking still works while the app is open.'
        );
      }
    } catch { /* older OS / denied — foreground still works */ }

    // reset
    setPoints([]); setDistanceKm(0); setElapsed(0);
    pausedRef.current = false;
    pauseWindowsRef.current = [];
    startTimeRef.current = new Date();
    startEpochRef.current = Date.now();
    pausedAccumMsRef.current = 0;
    pauseStartRef.current = 0;

    try {
      await startLiveTracking({ clear: true });
    } catch (e) {
      Alert.alert('Could not start tracking', e?.message || 'Please try again.');
      return;
    }
    activeRef.current = true;

    // Poll the (foreground OR background) buffer to draw the live route.
    pollRef.current = setInterval(() => { refreshFromBuffer(); }, 1500);
    // Derive elapsed from wall-clock each tick (no accumulation error/jumps).
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      const ms = Date.now() - startEpochRef.current - pausedAccumMsRef.current;
      setElapsed(Math.max(0, Math.floor(ms / 1000)));
    }, 500);
    setPhase('running');
  };

  const pause = () => {
    pausedRef.current = true;
    pauseStartRef.current = Date.now();
    pauseWindowsRef.current.push({ start: Date.now(), end: null });
    setPhase('paused');
  };
  const resume = () => {
    const w = pauseWindowsRef.current[pauseWindowsRef.current.length - 1];
    if (w && w.end == null) w.end = Date.now();
    if (pauseStartRef.current) {
      pausedAccumMsRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = 0;
    }
    pausedRef.current = false;
    setPhase('running');
  };

  const finish = async () => {
    pausedRef.current = true;
    stopTracking();
    await refreshFromBuffer();   // pull the final points before showing the review
    setPhase('review');
  };

  const discard = () => {
    stopTracking();
    clearLiveBuffer();
    setPhase('idle'); setPoints([]); setDistanceKm(0); setElapsed(0);
    pauseWindowsRef.current = []; pausedRef.current = false;
  };

  const save = async () => {
    const durationMin = Math.max(1, Math.round(elapsed / 60));
    const start = startTimeRef.current || new Date();
    const end = new Date();
    const sessionLoad = durationMin * exertion;
    try {
      setSaving(true);
      const res = await createActivityLog({
        userID: userId,
        activityTypeID: activityId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        distanceKM: Number(distanceKm.toFixed(3)),
        avgHeartRate: 0,
        maxHeartRate: 0,
        caloriesBurned: 0,
        sourceDevice: 'GPS',
        exertionLevel: exertion,
        duration: durationMin,
        calculatedLoadForSession: Math.round(sessionLoad),
        isConfirmed: true,
      });
      const newLogId = res?.data?.activityID ?? res?.data?.ActivityID ?? null;

      // Persist the polyline on-device so WorkoutRouteScreen can redraw it later.
      // Key by the stable log id (the Health list passes activityID) AND by
      // startTime as a fallback — the immediate view below doesn't need either.
      if (points.length >= 2) {
        const payload = JSON.stringify({ points, activityTypeID: activityId, distanceKM: distanceKm, duration: durationMin });
        try {
          if (newLogId != null) await AsyncStorage.setItem(ROUTE_KEY_LOG(newLogId), payload);
          await AsyncStorage.setItem(ROUTE_KEY(start.toISOString()), payload);
        } catch {}
      }

      clearLiveBuffer(); // the run is saved — drop the live point buffer

      // ActivityLog invariant: recalc the workout's day AND today.
      await calculateDailyLoad(userId, start).catch(() => {});
      await calculateDailyLoad(userId, new Date()).catch(() => {});
      try { await markWorkoutToday(start); } catch {}

      const workout = {
        activityID: newLogId,
        activityTypeID: activityId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        duration: durationMin,
        distanceKM: distanceKm,
        caloriesBurned: 0,
      };
      // Show the saved route immediately (points passed directly).
      navigation.replace('WorkoutRoute', { workout, routePoints: points });
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data || e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cameraPosition = useMemo(
    () => (center ? { coordinates: center, zoom: 16 } : undefined),
    [center]
  );

  const mapPolylines = points.length >= 2 ? [{ coordinates: points, color: Colors.primary, width: 6 }] : [];
  // Drop a pin at the latest tracked point while running, or at the current
  // location before the run starts (so the map isn't pin-less at idle).
  const mapMarkers = points.length >= 1
    ? [{ coordinates: points[points.length - 1], title: 'You' }]
    : center
      ? [{ coordinates: center, title: 'You are here' }]
      : [];

  const renderMap = () => {
    if (GoogleMaps?.View && center) {
      return (
        <GoogleMaps.View
          style={styles.map}
          cameraPosition={cameraPosition}
          polylines={mapPolylines}
          markers={mapMarkers}
        />
      );
    }
    return (
      <View style={styles.mapFallback}>
        <Ionicons name="map-outline" size={46} color={Colors.textMuted} />
        <Text style={styles.mapFallbackText}>
          {center ? 'Map module not in this build — tracking still works.' : 'Waiting for GPS…'}
        </Text>
      </View>
    );
  };

  const activityLabel = TRACK_ACTIVITIES.find((a) => a.id === activityId)?.label || 'Run';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Track a run" subtitle="Live GPS route" onBack={() => {
        if (phase === 'running' || phase === 'paused') {
          Alert.alert('Stop tracking?', 'Leaving will discard this route.', [
            { text: 'Keep tracking', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => { discard(); navigation.goBack(); } },
          ]);
        } else { navigation.goBack(); }
      }} />

      {/* activity picker (idle only) — scrolls; every route-coverable activity */}
      {phase === 'idle' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.actScroll}
          contentContainerStyle={styles.actRow}
        >
          {TRACK_ACTIVITIES.map((a) => {
            const active = activityId === a.id;
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.actChip, active && styles.actChipActive]}
                onPress={() => setActivityId(a.id)}
                activeOpacity={0.85}
              >
                <ActivityIcon activityTypeId={a.id} size={18} color={active ? '#0A1628' : undefined} />
                <Text style={[styles.actChipText, active && styles.actChipTextActive]}>{a.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.mapWrap}>{renderMap()}</View>

      {/* live stats */}
      <View style={styles.statsRow}>
        <Stat styles={styles} label="Time" value={fmtClock(elapsed)} />
        <Stat styles={styles} label="Distance" value={`${distanceKm.toFixed(2)} km`} />
        <Stat styles={styles} label="Pace" value={paceStr(distanceKm, elapsed)} />
      </View>

      {/* controls */}
      <View style={styles.controls}>
        {phase === 'idle' && (
          <TouchableOpacity style={[styles.bigBtn, styles.startBtn]} onPress={start} activeOpacity={0.9}>
            <Ionicons name="play" size={22} color="#0A1628" />
            <Text style={styles.bigBtnText}>Start {activityLabel.toLowerCase()}</Text>
          </TouchableOpacity>
        )}

        {(phase === 'running' || phase === 'paused') && (
          <View style={styles.runControls}>
            {phase === 'running' ? (
              <TouchableOpacity style={[styles.roundBtn, styles.pauseBtn]} onPress={pause} activeOpacity={0.9}>
                <Ionicons name="pause" size={26} color="#0A1628" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.roundBtn, styles.startBtn]} onPress={resume} activeOpacity={0.9}>
                <Ionicons name="play" size={26} color="#0A1628" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.roundBtn, styles.stopBtn]} onPress={finish} activeOpacity={0.9}>
              <Ionicons name="stop" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {phase === 'review' && (
          <View style={styles.review}>
            <Text style={styles.reviewTitle}>Nice work! How hard was it?</Text>
            <View style={styles.exRow}>
              <Text style={styles.exLabel}>Effort</Text>
              <Text style={styles.exValue}>{exertion}/10</Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={exertion}
              onValueChange={setExertion}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={Colors.primary}
            />
            <TouchableOpacity style={[styles.bigBtn, styles.startBtn]} onPress={save} disabled={saving} activeOpacity={0.9}>
              {saving ? <ActivityIndicator color="#0A1628" /> : (
                <>
                  <Ionicons name="save" size={20} color="#0A1628" />
                  <Text style={styles.bigBtnText}>Save workout</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.discardBtn} onPress={discard} disabled={saving}>
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const Stat = ({ styles, label, value }) => (
  <View style={styles.statTile}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  actScroll: { flexGrow: 0 },
  actRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  actChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.cardBackgroundLight,
  },
  actChipActive: { borderColor: C.primary, backgroundColor: C.primary },
  actChipText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
  actChipTextActive: { color: '#0A1628' },
  mapWrap: { flex: 1, minHeight: 220 },
  map: { flex: 1 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mapFallbackText: { color: C.textMuted, fontSize: 13, marginTop: 10, textAlign: 'center' },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.cardBackground,
  },
  statTile: { alignItems: 'center' },
  statValue: { color: C.textPrimary, fontSize: 24, fontWeight: '900' },
  statLabel: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  controls: { padding: 16, backgroundColor: C.cardBackground },
  bigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 15,
  },
  bigBtnText: { color: '#0A1628', fontSize: 16, fontWeight: '800' },
  startBtn: { backgroundColor: C.primary },
  runControls: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  roundBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  pauseBtn: { backgroundColor: C.primary },
  stopBtn: { backgroundColor: C.danger },
  review: {},
  reviewTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  exRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingHorizontal: 2 },
  exLabel: { color: C.textSecondary, fontSize: 13 },
  exValue: { color: C.primary, fontSize: 16, fontWeight: '800', minWidth: 64, textAlign: 'right' },
  discardBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  discardText: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
});

export default LiveRunScreen;
