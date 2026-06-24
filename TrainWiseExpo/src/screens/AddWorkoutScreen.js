import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import ThemedDateTimePicker from '../components/ThemedDateTimePicker';
import { Colors, Fonts, Spacing } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import ComboBox from '../components/ComboBox';
import ActivityIcon from '../components/ActivityIcon';
import {
  getAllActivityTypes,
  createActivityLog,
  calculateDailyLoad,
  getDailyLoadByUser,
  checkRecords,
} from '../services/api';
import { useAuth } from '../api/AuthContext';
import { sendLoadWarningIfNeeded, markWorkoutToday } from '../api/NotificationService';
import { getCurrentWeather } from '../api/weatherService';
import { buildSmartSuggestion } from '../utils/smartWorkout';
import { grantCoins } from '../utils/checkInManager';
import { findBadgeDef } from '../utils/badges';

const { width: SCREEN_W } = Dimensions.get('window');

const ACTIVITY_FIELDS = {
  'Running':       ['duration', 'distance', 'exertion'],
  'Walking':       ['duration', 'distance', 'exertion'],
  'Cycling':       ['duration', 'distance', 'exertion'],
  'Swimming':      ['duration', 'distance', 'exertion'],
  'Weightlifting': ['duration', 'exertion'],
  'Powerlifting':  ['duration', 'exertion'],
  'CrossFit':      ['duration', 'exertion'],
  'Yoga':          ['duration', 'exertion'],
  'Pilates':       ['duration', 'exertion'],
  'HIIT':          ['duration', 'exertion'],
  'Boxing':        ['duration', 'exertion'],
  'Basketball':    ['duration', 'exertion'],
  'Football':      ['duration', 'exertion'],
  'Tennis':        ['duration', 'exertion'],
};

// Live-Workout target options (mockup images 5-8).
const TARGETS = [
  { key: 'free', label: 'No target', unit: '' },
  { key: 'distance', label: 'Distance', unit: 'km' },
  { key: 'time', label: 'Time', unit: 'min' },
  { key: 'calories', label: 'Calories', unit: 'kcal' },
];

const formatElapsed = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const AddWorkoutScreen = ({ navigation, route }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);

  // Shared
  const [activityTypes, setActivityTypes] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Tabs: 0 = Live Workout, 1 = Already Done. Tabs switch by tap (NOT a swipe
  // pager) so inner horizontal gestures — the exertion slider and the
  // suggested-activity chips — no longer steal the page swipe (item 13).
  const initialTab = route?.params?.liveTab === false ? 1 : 0;
  const [tab, setTab] = useState(initialTab);

  // Smart suggestion (kept from the old screen — shown on the Live tab)
  const [weather, setWeather] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [smartOpen, setSmartOpen] = useState(true);
  const [debugMsg, setDebugMsg] = useState(null);

  // Live Workout state
  const [targetType, setTargetType] = useState('free');
  const [targetValue, setTargetValue] = useState('');
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);   // item 7 — break/resume
  const [elapsedSec, setElapsedSec] = useState(0);
  const startRef = useRef(null);   // wall-clock start (for the log's startTime)
  const segStartRef = useRef(null); // start of the current (un-paused) segment
  const accumRef = useRef(0);       // seconds accumulated across past segments
  const intervalRef = useRef(null);
  const [showExertionModal, setShowExertionModal] = useState(false);
  const [liveExertion, setLiveExertion] = useState(5);
  const [liveDistance, setLiveDistance] = useState('');

  // Already Done state
  const [startTime, setStartTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');
  const [duration, setDuration] = useState('');
  const [doneDistance, setDoneDistance] = useState('');
  const [doneExertion, setDoneExertion] = useState(5);

  const shouldShow = (field) => {
    const typeName = selectedActivity?.typeName || '';
    const fields = ACTIVITY_FIELDS[typeName] || ['duration', 'exertion'];
    return fields.includes(field);
  };

  const faceColor = (status) =>
    status === 'good' ? Colors.success : status === 'warn' ? Colors.warning : Colors.danger;

  useEffect(() => {
    loadActivityTypes();
    // Smart suggestion moved to the Home screen (item 4) — no longer fetched
    // here, so the suggestion card never renders on AddWorkout.
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-select the activity passed from the Home Add-Workout card (B-2).
  useEffect(() => {
    const preId = route?.params?.preselectActivityTypeId;
    if (preId != null && activityTypes.length) {
      const match = activityTypes.find((a) => a.activityTypeID === preId);
      if (match) setSelectedActivity(match);
    }
  }, [route?.params?.preselectActivityTypeId, activityTypes]);

  const loadSmartSuggestion = async () => {
    let acRatio = null;
    try {
      const res = await getDailyLoadByUser(userId);
      const rows = Array.isArray(res.data) ? res.data : [];
      if (rows.length) {
        const latest = rows.reduce((best, cur) => {
          const bd = new Date(best.date ?? best.Date ?? 0).getTime();
          const cd = new Date(cur.date ?? cur.Date ?? 0).getTime();
          return cd > bd ? cur : best;
        });
        acRatio = latest.aC_Ratio ?? latest.AC_Ratio ?? latest.acRatio ?? null;
      }
    } catch {
      // no load history yet — fine
    }
    try {
      const w = await getCurrentWeather();
      setWeather(w);
      setSuggestion(buildSmartSuggestion({ weather: w, acRatio }));
      setDebugMsg(null);
    } catch (e) {
      setDebugMsg(e?.message || String(e));
      setSuggestion(buildSmartSuggestion({ weather: null, acRatio }));
    }
  };

  const loadActivityTypes = async () => {
    try {
      const response = await getAllActivityTypes();
      setActivityTypes(response.data || []);
    } catch (error) {
      console.log('Failed to load activity types:', error.message);
      setActivityTypes([
        { activityTypeID: 1, typeName: 'Running' },
        { activityTypeID: 2, typeName: 'Walking' },
        { activityTypeID: 3, typeName: 'Cycling' },
        { activityTypeID: 4, typeName: 'CrossFit' },
        { activityTypeID: 5, typeName: 'Swimming' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── Tab switching (tap only, no swipe) ──
  const goTab = (i) => setTab(i);

  // ── Live timer (supports pause/resume — item 7) ──
  const tick = () => {
    setElapsedSec(accumRef.current + Math.floor((Date.now() - segStartRef.current) / 1000));
  };

  const startLive = () => {
    if (!selectedActivity) {
      Alert.alert('Pick an activity', 'Select a workout type before starting.');
      return;
    }
    startRef.current = new Date();
    accumRef.current = 0;
    segStartRef.current = Date.now();
    setElapsedSec(0);
    setRunning(true);
    setPaused(false);
    intervalRef.current = setInterval(tick, 1000);
  };

  // Pause: bank the current segment's seconds and stop ticking.
  const pauseLive = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    accumRef.current += Math.floor((Date.now() - segStartRef.current) / 1000);
    setElapsedSec(accumRef.current);
    setPaused(true);
  };

  // Resume: open a fresh segment and tick again.
  const resumeLive = () => {
    segStartRef.current = Date.now();
    setPaused(false);
    intervalRef.current = setInterval(tick, 1000);
  };

  const stopLive = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    // If we were mid-segment (not paused), bank the final stretch.
    if (!paused && segStartRef.current) {
      accumRef.current += Math.floor((Date.now() - segStartRef.current) / 1000);
    }
    setElapsedSec(accumRef.current);
    setRunning(false);
    setPaused(false);
    setLiveExertion(5);
    setLiveDistance('');
    setShowExertionModal(true);
  };

  const confirmLive = () => {
    setShowExertionModal(false);
    const elapsedMin = Math.max(1, Math.round(elapsedSec / 60));
    submitWorkout({
      start: startRef.current || new Date(),
      end: new Date(),
      durationMin: elapsedMin,
      exertion: liveExertion,
      distance: liveDistance,
    });
  };

  // ── Already Done submit ──
  const onPickerChange = (event, selected) => {
    // Android closes the picker on each step; we chain date -> time.
    if (event.type === 'dismissed') {
      setShowPicker(false);
      return;
    }
    if (!selected) {
      setShowPicker(false);
      return;
    }
    if (pickerMode === 'date') {
      const nd = new Date(startTime);
      nd.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setStartTime(nd);
      setShowPicker(false);
      // immediately open the time step
      setTimeout(() => {
        setPickerMode('time');
        setShowPicker(true);
      }, 50);
    } else {
      const nd = new Date(startTime);
      nd.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setStartTime(nd);
      setShowPicker(false);
    }
  };

  const handleDoneSubmit = () => {
    if (!selectedActivity) {
      Alert.alert('Missing Info', 'Please select an activity type');
      return;
    }
    const dur = parseInt(duration, 10);
    if (!duration || isNaN(dur)) {
      Alert.alert('Missing Info', 'Please enter a valid duration in minutes');
      return;
    }
    if (dur > 480) {
      Alert.alert('Invalid Duration', 'Session duration cannot exceed 480 minutes (8 hours).');
      return;
    }
    if (startTime.getTime() > Date.now() + 60000) {
      Alert.alert('Invalid time', 'The start time cannot be in the future.');
      return;
    }
    submitWorkout({
      start: startTime,
      end: new Date(startTime.getTime() + dur * 60000),
      durationMin: dur,
      exertion: doneExertion,
      distance: doneDistance,
    });
  };

  // ── Shared submit (both tabs) ──
  const submitWorkout = async ({ start, end, durationMin, exertion, distance }) => {
    setSubmitting(true);
    try {
      const sessionLoad = durationMin * exertion;
      await createActivityLog({
        userID: userId,
        activityTypeID: selectedActivity.activityTypeID,
        startTime: start.toISOString(),
        endTime: (end || new Date()).toISOString(),
        distanceKM: shouldShow('distance') ? parseFloat(distance) || 0 : 0,
        avgHeartRate: 0,
        maxHeartRate: 0,
        caloriesBurned: 0,
        sourceDevice: 'Manual',
        exertionLevel: exertion,
        duration: durationMin,
        calculatedLoadForSession: Math.round(sessionLoad),
        isConfirmed: true,
      });

      // Recalc the workout's day AND today so the rolling 7/28-day windows
      // pick it up (ActivityLog invariants + B-5).
      const today = new Date();
      const sameDay = start.toDateString() === today.toDateString();
      if (!sameDay) {
        await calculateDailyLoad(userId, start);
      }
      const calcResponse = await calculateDailyLoad(userId, today);
      const result = calcResponse.data || {};

      // B-3: remember the workout day (local date) so the daily reminder can
      // skip it. Past workouts mark their own day, not today.
      await markWorkoutToday(start);

      await sendLoadWarningIfNeeded(
        result.ac_Ratio ?? result.acRatio ?? 0,
        result.loadLevel ?? 'Green'
      );

      // A-5: award personal records / badges and reward new ones with coins.
      let newBadges = [];
      try {
        const rec = await checkRecords(userId);
        newBadges = rec.data?.newBadges || rec.data?.NewBadges || [];
        if (newBadges.length) await grantCoins(newBadges.length * 20);
      } catch {}

      navigation.navigate('WorkoutSummary', {
        summary: {
          activityName: selectedActivity.typeName,
          duration: durationMin,
          exertion,
          sessionLoad: Math.round(sessionLoad),
          loadLevel: result.loadLevel || 'Green',
          acuteLoad: result.acuteLoad || 0,
          chronicLoad: result.chronicLoad || 0,
          acRatio: result.ac_Ratio || result.acRatio || 0,
          stressScore: result.stressScore || 0,
          recommendation:
            result.recommendationText ||
            'Good session! Keep up the consistent training.',
        },
      });

      if (newBadges.length) {
        const names = newBadges.map((k) => findBadgeDef(k).label).join(', ');
        Alert.alert(
          '🎉 New badge unlocked!',
          `${names}\n+${newBadges.length * 20} coins earned`
        );
      }
    } catch (error) {
      const serverMsg = error?.response?.data || error?.message || 'unknown error';
      console.log('Submit error:', serverMsg);
      Alert.alert('Error', `Could not save workout:\n${serverMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const targetUnit = TARGETS.find((t) => t.key === targetType)?.unit || '';
  // Step sizes for the +/- target picker (item 5).
  const TARGET_STEP = { distance: 0.5, time: 5, calories: 50 };
  const stepTarget = (dir) => {
    const step = TARGET_STEP[targetType] || 1;
    const cur = Number(targetValue) || 0;
    const next = Math.max(0, Math.round((cur + dir * step) * 100) / 100);
    setTargetValue(String(next));
  };
  const timeProgress =
    targetType === 'time' && Number(targetValue) > 0
      ? Math.min(1, elapsedSec / (Number(targetValue) * 60))
      : null;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <ScreenHeader
          title="Add a Workout"
          subtitle="Log your training session"
          onBack={() => navigation.goBack()}
        />

        {/* Shared activity picker (above the tab switcher) */}
        <View style={styles.activityPicker}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <View style={styles.activityRow}>
              {selectedActivity && (
                <ActivityIcon
                  activityTypeId={selectedActivity.activityTypeID}
                  typeName={selectedActivity.typeName}
                  size={24}
                />
              )}
              <View style={{ flex: 1 }}>
                <ComboBox
                  items={activityTypes}
                  selectedValue={selectedActivity?.activityTypeID}
                  onChange={(item) => {
                    setSelectedActivity(item);
                    setDoneDistance('');
                    setLiveDistance('');
                  }}
                  labelKey="typeName"
                  valueKey="activityTypeID"
                  placeholder="Select workout type"
                />
              </View>
            </View>
          )}
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 0 && styles.tabBtnActive]}
            onPress={() => goTab(0)}
            activeOpacity={0.85}
          >
            <Ionicons
              name="play-circle"
              size={16}
              color={tab === 0 ? Colors.textPrimary : Colors.textSecondary}
            />
            <Text style={[styles.tabText, tab === 0 && styles.tabTextActive]}>Live Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 1 && styles.tabBtnActive]}
            onPress={() => goTab(1)}
            activeOpacity={0.85}
          >
            <Ionicons
              name="checkmark-done-circle"
              size={16}
              color={tab === 1 ? Colors.textPrimary : Colors.textSecondary}
            />
            <Text style={[styles.tabText, tab === 1 && styles.tabTextActive]}>Already Done</Text>
          </TouchableOpacity>
        </View>

        {/* Tab content (conditional render — no swipe pager, see item 13) */}
        {tab === 0 ? (
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={styles.pageContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Smart suggestion (kept) */}
              {!suggestion && debugMsg && (
                <View style={styles.debugBox}>
                  <Text style={styles.debugTitle}>Smart suggestion unavailable (debug)</Text>
                  <Text style={styles.debugText}>{debugMsg}</Text>
                </View>
              )}
              {suggestion && (
                <View style={styles.smartCard}>
                  <TouchableOpacity
                    style={styles.smartHeader}
                    activeOpacity={0.8}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setSmartOpen((o) => !o);
                    }}
                  >
                    <View style={styles.smartHeaderLeft}>
                      <Ionicons name="sparkles" size={15} color={Colors.primary} />
                      <Text style={styles.smartHeaderText}>SMART SUGGESTION</Text>
                    </View>
                    <View style={styles.smartHeaderRight}>
                      {weather?.tempC != null && (
                        <Text style={styles.smartWeather} numberOfLines={1}>
                          {Math.round(weather.tempC)}°
                          {weather.description ? ` · ${weather.description}` : ''}
                        </Text>
                      )}
                      <Ionicons
                        name={smartOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={Colors.primary}
                      />
                    </View>
                  </TouchableOpacity>

                  <View style={styles.smartTop}>
                    <Text style={styles.smartEmoji}>{suggestion.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.smartTitle}>{suggestion.title}</Text>
                    </View>
                    <View
                      style={[styles.ratingPill, { borderColor: faceColor(suggestion.rating.faceColor) }]}
                    >
                      <Text
                        style={[styles.ratingPillLabel, { color: faceColor(suggestion.rating.faceColor) }]}
                      >
                        {suggestion.rating.label}
                      </Text>
                      {suggestion.score != null && (
                        <Text style={styles.ratingPillScore}>{suggestion.score}/100</Text>
                      )}
                    </View>
                  </View>

                  {smartOpen && (
                    <>
                      <Text style={styles.smartReason}>{suggestion.reason}</Text>
                      {suggestion.factors.length > 0 && (
                        <View style={styles.factorRow}>
                          {suggestion.factors.map((f) => (
                            <View key={f.key} style={styles.factorTile}>
                              <View style={styles.factorIconRow}>
                                <Ionicons name={f.icon} size={15} color={faceColor(f.status)} />
                                <View style={[styles.factorDot, { backgroundColor: faceColor(f.status) }]} />
                              </View>
                              <Text style={styles.factorValue} numberOfLines={1}>{f.value}</Text>
                              <Text style={styles.factorLabel} numberOfLines={1}>{f.label}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <Text style={styles.smartPick}>
                        {suggestion.indoorPreferred ? 'Suggested indoor activities' : 'Suggested activities'} · tap to pick
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                        {suggestion.activities.map((name) => {
                          const match = activityTypes.find(
                            (a) => (a.typeName || '').toLowerCase() === name.toLowerCase()
                          );
                          if (!match) return null;
                          const selected = selectedActivity?.activityTypeID === match.activityTypeID;
                          return (
                            <TouchableOpacity
                              key={name}
                              style={[styles.chip, selected && styles.chipSelected]}
                              onPress={() => {
                                setSelectedActivity(match);
                                setLiveDistance('');
                                setDoneDistance('');
                              }}
                            >
                              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                {name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </>
                  )}
                </View>
              )}

              {/* Target — combo box + adapted +/- value picker (item 5) */}
              {!running && (
                <Card style={styles.tightCard}>
                  <Text style={styles.cardTitle}>Target</Text>
                  <ComboBox
                    items={TARGETS}
                    selectedValue={targetType}
                    onChange={(item) => {
                      setTargetType(item.key);
                      setTargetValue('');
                    }}
                    labelKey="label"
                    valueKey="key"
                    placeholder="No target"
                    searchable={false}
                  />
                  {targetType !== 'free' && (
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => stepTarget(-1)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="remove" size={26} color={Colors.primary} />
                      </TouchableOpacity>
                      <View style={styles.stepValueWrap}>
                        <TextInput
                          style={styles.stepValue}
                          value={targetValue}
                          onChangeText={setTargetValue}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={Colors.textMuted}
                          textAlign="center"
                        />
                        <Text style={styles.stepUnit}>{targetUnit}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => stepTarget(1)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={26} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              )}

              {/* Timer */}
              <Card style={styles.tightCard}>
                {running ? (
                  <View style={styles.timerWrap}>
                    <Text style={styles.timerValue}>{formatElapsed(elapsedSec)}</Text>
                    {paused && <Text style={styles.pausedTag}>On break</Text>}
                    {timeProgress != null && (
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${timeProgress * 100}%` }]} />
                      </View>
                    )}
                    {targetType !== 'free' && targetType !== 'time' && Number(targetValue) > 0 && (
                      <Text style={styles.timerHint}>
                        Target: {targetValue} {targetUnit}
                      </Text>
                    )}
                    <View style={styles.liveBtnRow}>
                      <TouchableOpacity
                        style={styles.breakBtn}
                        onPress={paused ? resumeLive : pauseLive}
                        activeOpacity={0.85}
                      >
                        <Ionicons name={paused ? 'play' : 'pause'} size={18} color={Colors.primary} />
                        <Text style={styles.breakBtnText}>{paused ? 'RESUME' : 'BREAK'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.stopBtnInline} onPress={stopLive} activeOpacity={0.85}>
                        <Ionicons name="stop" size={18} color="#fff" />
                        <Text style={styles.stopBtnText}>STOP</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.timerWrap}>
                    <Text style={styles.timerIdle}>Ready when you are</Text>
                    <TouchableOpacity style={styles.startBtn} onPress={startLive} activeOpacity={0.85}>
                      <Ionicons name="play" size={20} color="#fff" />
                      <Text style={styles.startBtnText}>START</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            </ScrollView>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={styles.pageContent}
              keyboardShouldPersistTaps="handled"
            >
              <Card style={styles.tightCard}>
                <Text style={styles.cardTitle}>Start Time</Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowPicker(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                  <Text style={styles.dateBtnText}>
                    {startTime.toLocaleString('en-US', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </TouchableOpacity>
                <ThemedDateTimePicker
                  visible={showPicker}
                  value={startTime}
                  maximumDate={new Date()}
                  onCancel={() => setShowPicker(false)}
                  onConfirm={(d) => {
                    setStartTime(d);
                    setShowPicker(false);
                  }}
                />
              </Card>

              <Card style={styles.tightCard}>
                <Text style={styles.cardTitle}>Session Duration (min)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 45"
                  placeholderTextColor={Colors.textMuted}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                />
              </Card>

              {shouldShow('distance') && (
                <Card style={styles.tightCard}>
                  <Text style={styles.cardTitle}>Distance (km)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 5.2"
                    placeholderTextColor={Colors.textMuted}
                    value={doneDistance}
                    onChangeText={setDoneDistance}
                    keyboardType="decimal-pad"
                  />
                </Card>
              )}

              <Card style={styles.tightCard}>
                <Text style={styles.cardTitle}>Exertion Level: {doneExertion} / 10</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  value={doneExertion}
                  onValueChange={setDoneExertion}
                  minimumTrackTintColor={Colors.primary}
                  maximumTrackTintColor={Colors.border}
                  thumbTintColor={Colors.primary}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabelText}>Easy</Text>
                  <Text style={styles.sliderLabelText}>Max Effort</Text>
                </View>
              </Card>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleDoneSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Workout</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Live → post-session exertion modal */}
      <Modal
        visible={showExertionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExertionModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowExertionModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Nice work! How hard was it?</Text>
            <Text style={styles.modalElapsed}>
              {formatElapsed(elapsedSec)} · {Math.max(1, Math.round(elapsedSec / 60))} min
            </Text>
            <Text style={styles.modalExertion}>Exertion: {liveExertion} / 10</Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={liveExertion}
              onValueChange={setLiveExertion}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={Colors.primary}
            />
            {shouldShow('distance') && (
              <TextInput
                style={[styles.input, { marginTop: Spacing.md }]}
                placeholder="Distance (km, optional)"
                placeholderTextColor={Colors.textMuted}
                value={liveDistance}
                onChangeText={setLiveDistance}
                keyboardType="decimal-pad"
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowExertionModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCancelText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={confirmLive}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pageContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  // Tighter card padding so the workout-screen blocks aren't oversized (item 3).
  tightCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },

  // Shared activity picker
  activityPicker: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: Colors.textPrimary },

  // Target point
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  targetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
  },
  targetChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  targetChipText: { color: Colors.textSecondary, fontSize: Fonts.bodySize },
  targetChipTextActive: { color: Colors.textPrimary, fontWeight: Fonts.bold },
  targetInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  targetInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    fontSize: Fonts.bodySize,
  },
  targetUnit: { color: Colors.textSecondary, fontSize: Fonts.bodySize, fontWeight: '700' },

  // Target +/- value picker (item 5)
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.cardBackgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  stepValue: {
    color: Colors.textPrimary,
    fontSize: 40,
    fontWeight: '900',
    minWidth: 90,
    padding: 0,
  },
  stepUnit: { color: Colors.textSecondary, fontSize: Fonts.subtitleSize, fontWeight: '800' },

  // Timer
  timerWrap: { alignItems: 'center', paddingVertical: Spacing.xs },
  pausedTag: { color: Colors.warning, fontSize: Fonts.captionSize, fontWeight: '800', marginTop: 4 },
  liveBtnRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  breakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.cardBackgroundLight,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 30,
  },
  breakBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  stopBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.danger,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 30,
  },
  timerValue: { color: Colors.textPrimary, fontSize: 52, fontWeight: '900', letterSpacing: 1 },
  timerIdle: { color: Colors.textSecondary, fontSize: Fonts.bodySize, marginBottom: Spacing.md },
  timerHint: { color: Colors.textSecondary, fontSize: Fonts.captionSize, marginTop: Spacing.sm },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.danger,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    marginTop: Spacing.lg,
  },
  stopBtnText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },

  // Already Done
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  dateBtnText: { color: Colors.textPrimary, fontSize: Fonts.bodySize, fontWeight: '600' },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    fontSize: Fonts.bodySize,
  },
  slider: { width: '100%', height: 40 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabelText: { color: Colors.textMuted, fontSize: Fonts.captionSize },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Smart suggestion card (kept)
  smartCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  smartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  debugBox: {
    backgroundColor: '#3a2a00',
    borderColor: Colors.warning,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  debugTitle: { color: Colors.warning, fontSize: Fonts.captionSize, fontWeight: '800', marginBottom: 4 },
  debugText: { color: '#ffd', fontSize: Fonts.captionSize, lineHeight: 16 },
  smartHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smartHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, marginLeft: 8 },
  smartHeaderText: { color: Colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  smartWeather: { color: Colors.textSecondary, fontSize: Fonts.captionSize, flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  smartTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  smartEmoji: { fontSize: 30, marginTop: 2 },
  smartTitle: { color: Colors.textPrimary, fontSize: Fonts.subtitleSize, fontWeight: '900' },
  smartReason: { color: Colors.textSecondary, fontSize: Fonts.bodySize, lineHeight: 19, marginTop: 10 },
  ratingPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: Colors.cardBackgroundLight,
    minWidth: 62,
  },
  ratingPillLabel: { fontSize: 13, fontWeight: '900' },
  ratingPillScore: { color: Colors.textMuted, fontSize: 10, marginTop: 1, fontWeight: '700' },
  factorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  factorTile: { width: '33.33%', alignItems: 'center', paddingVertical: 6 },
  factorIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factorDot: { width: 6, height: 6, borderRadius: 3 },
  factorValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 3 },
  factorLabel: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  smartPick: { color: Colors.textSecondary, fontSize: Fonts.captionSize, fontWeight: '700', marginTop: Spacing.md },
  chipRow: { paddingVertical: Spacing.sm },
  chip: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: Fonts.bodySize },
  chipTextSelected: { color: Colors.textPrimary, fontWeight: Fonts.bold },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalSheet: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: Fonts.subtitleSize, fontWeight: '900', marginBottom: 4 },
  modalElapsed: { color: Colors.textSecondary, fontSize: Fonts.bodySize, marginBottom: Spacing.md },
  modalExertion: { color: Colors.primary, fontSize: Fonts.bodySize, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalCancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '800' },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default AddWorkoutScreen;
