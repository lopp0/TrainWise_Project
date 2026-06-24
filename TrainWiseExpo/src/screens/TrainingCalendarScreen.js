import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Pressable,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { Colors, Spacing } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import ComboBox from '../components/ComboBox';
import ActivityIcon from '../components/ActivityIcon';
import { useAuth } from '../api/AuthContext';
import {
  getCalendar,
  createPlannedWorkout,
  updatePlannedWorkout,
  deletePlannedWorkout,
  completePlannedWorkout,
  getAllActivityTypes,
  createActivityLog,
  calculateDailyLoad,
} from '../services/api';
import { markWorkoutToday } from '../api/NotificationService';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const TrainingCalendarScreen = ({ navigation, route }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);

  // Coach planning for a trainee: pass { targetUserId, coachMode, traineeName }.
  const targetUserId = route?.params?.targetUserId ?? userId;
  const coachMode = !!route?.params?.coachMode;
  const traineeName = route?.params?.traineeName;

  const today = new Date();
  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [plans, setPlans] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [activity, setActivity] = useState(null);
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Complete modal (asks exertion + confirms numbers, then logs a real workout)
  const [completePlan, setCompletePlan] = useState(null);
  const [compExertion, setCompExertion] = useState(5);
  const [compDuration, setCompDuration] = useState('');
  const [compDistance, setCompDistance] = useState('');
  const [completing, setCompleting] = useState(false);

  // Keyboard height so the bottom-sheet modals lift above the keyboard and the
  // inputs stay visible (item 11). Deterministic across Android/iOS.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates?.height ?? 0)
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const todayStr = ymd(today);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCalendar(targetUserId, ymd(monthStart), ymd(monthEnd));
      const list = Array.isArray(res.data) ? res.data : [];
      setPlans(list);
      // On the trainee's own calendar, mark coach-created plans as seen so the
      // Home calendar badge clears (item 11).
      if (!coachMode && targetUserId === userId) {
        try {
          const key = `@trainwise_seen_coach_plans_${userId}`;
          const seenRaw = await AsyncStorage.getItem(key);
          const seen = new Set(seenRaw ? JSON.parse(seenRaw) : []);
          list.forEach((p) => {
            if (p.createdByCoach ?? p.CreatedByCoach) seen.add(p.planId ?? p.PlanId);
          });
          await AsyncStorage.setItem(key, JSON.stringify([...seen]));
        } catch {}
      }
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, year, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    getAllActivityTypes()
      .then((res) => setActivityTypes(res.data || []))
      .catch(() => {});
  }, []);

  const activityName = (id) =>
    activityTypes.find((a) => (a.activityTypeID ?? a.ActivityTypeID) === id)?.typeName || 'Workout';

  const plansFor = (key) => plans.filter((p) => String(p.plannedDate ?? p.PlannedDate).slice(0, 10) === key);

  // ── Month grid (a regular calendar) ─────────────────────────────────────
  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const dayStatusColor = (key) => {
    const dayPlans = plansFor(key);
    if (dayPlans.length === 0) return null;
    const allDone = dayPlans.every((p) => p.isCompleted ?? p.IsCompleted);
    if (allDone) return '#00e676';
    const missed = key < todayStr && dayPlans.some((p) => !(p.isCompleted ?? p.IsCompleted));
    if (missed) return Colors.danger;
    return Colors.primary;
  };

  const shiftMonth = (delta) => {
    setMonthCursor(new Date(year, month + delta, 1));
  };

  // ── Add / edit ──────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingPlan(null);
    setActivity(null);
    setDuration('');
    setDistance('');
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    const aId = plan.activityTypeId ?? plan.ActivityTypeId;
    setActivity(activityTypes.find((a) => (a.activityTypeID ?? a.ActivityTypeID) === aId) || null);
    setDuration(String(plan.plannedDuration ?? plan.PlannedDuration ?? ''));
    setDistance(String(plan.plannedDistance ?? plan.PlannedDistance ?? ''));
    setNotes(plan.notes ?? plan.Notes ?? '');
    setModalOpen(true);
  };

  const save = async () => {
    const dur = duration ? parseInt(duration, 10) : null;
    const dist = distance ? parseFloat(distance) : null;
    const body = {
      activityTypeId: activity ? activity.activityTypeID : null,
      plannedDate: ymd(selectedDate),
      plannedDuration: dur,
      plannedDistance: dist,
      plannedLoad: dur ? dur * 5 : null,
      notes: notes.trim() || null,
      createdByCoach: coachMode ? userId : null,
    };
    setSaving(true);
    try {
      if (editingPlan) {
        await updatePlannedWorkout(editingPlan.planId ?? editingPlan.PlanId, body);
      } else {
        await createPlannedWorkout(targetUserId, body);
      }
      setModalOpen(false);
      load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data || 'Could not save plan.');
    } finally {
      setSaving(false);
    }
  };

  const planActions = (plan) => {
    const pid = plan.planId ?? plan.PlanId;
    const completed = plan.isCompleted ?? plan.IsCompleted;
    const options = [
      { text: 'Edit', onPress: () => openEdit(plan) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePlannedWorkout(pid);
            load();
          } catch {
            Alert.alert('Error', 'Could not delete.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ];
    if (!completed) {
      options.unshift({ text: 'Mark complete', onPress: () => openComplete(plan) });
    }
    Alert.alert('Planned workout', plan.notes ?? plan.Notes ?? 'Choose an action', options);
  };

  // ── Complete → log a real (confirmed) workout so it lands in the Health
  // tab and counts toward load, after asking the exertion level (item 11). ──
  const openComplete = (plan) => {
    setCompletePlan(plan);
    setCompExertion(5);
    setCompDuration(String(plan.plannedDuration ?? plan.PlannedDuration ?? ''));
    setCompDistance(String(plan.plannedDistance ?? plan.PlannedDistance ?? ''));
  };

  const confirmComplete = async () => {
    if (!completePlan) return;
    const pid = completePlan.planId ?? completePlan.PlanId;
    const activityTypeID = completePlan.activityTypeId ?? completePlan.ActivityTypeId;
    if (!activityTypeID) {
      Alert.alert('Set an activity', 'Edit this plan and pick an activity type first.');
      return;
    }
    const dur = parseInt(compDuration, 10) || Number(completePlan.plannedDuration ?? completePlan.PlannedDuration) || 30;
    const dist = compDistance ? parseFloat(compDistance) : 0;
    const exertion = compExertion;

    // Log at the planned date (noon local), but never in the future.
    const planned = new Date(String(completePlan.plannedDate ?? completePlan.PlannedDate).slice(0, 10) + 'T12:00:00');
    const start = planned.getTime() > Date.now() ? new Date() : planned;
    const end = new Date(start.getTime() + dur * 60000);

    setCompleting(true);
    try {
      const res = await createActivityLog({
        userID: targetUserId,
        activityTypeID,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        distanceKM: dist || 0,
        avgHeartRate: 0,
        maxHeartRate: 0,
        caloriesBurned: 0,
        sourceDevice: 'Planned',
        exertionLevel: exertion,
        duration: dur,
        calculatedLoadForSession: Math.round(dur * exertion),
        isConfirmed: true,
      });
      const newLogId = res.data?.activityID ?? res.data?.ActivityID ?? null;
      await completePlannedWorkout(pid, newLogId);

      // Recalc the day + today so the dashboards / load windows pick it up.
      if (start.toDateString() !== today.toDateString()) {
        await calculateDailyLoad(targetUserId, start);
      }
      await calculateDailyLoad(targetUserId, today);
      if (targetUserId === userId) await markWorkoutToday(start);

      setCompletePlan(null);
      load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data || 'Could not complete this workout.');
    } finally {
      setCompleting(false);
    }
  };

  const selectedKey = ymd(selectedDate);
  const selectedPlans = plansFor(selectedKey);
  const selectedLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={coachMode ? `Plan: ${traineeName || 'Trainee'}` : 'Training Calendar'}
        subtitle={coachMode ? 'Build their week' : 'Plan your training'}
        onBack={() => navigation.goBack()}
      />

      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Weekday header */}
        <View style={styles.weekRow}>
          {DAY_LABELS.map((d, i) => (
            <View key={i} style={styles.weekCell}>
              <Text style={styles.weekCellText}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Month grid */}
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 30 }} />
        ) : (
          weeks.map((wk, wi) => (
            <View key={wi} style={styles.weekRow}>
              {wk.map((cell, ci) => {
                if (!cell) return <View key={ci} style={styles.dayCell} />;
                const key = ymd(cell);
                const isToday = key === todayStr;
                const isSelected = key === selectedKey;
                const dot = dayStatusColor(key);
                return (
                  <TouchableOpacity
                    key={ci}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected, isToday && styles.dayCellToday]}
                    onPress={() => {
                      // Tapping the already-selected day opens the add sheet
                      // (item 7); the + button still works too.
                      if (key === selectedKey) openAdd();
                      else setSelectedDate(cell);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dayNum, isSelected && styles.dayNumSelected, isToday && !isSelected && styles.dayNumToday]}>
                      {cell.getDate()}
                    </Text>
                    {dot ? <View style={[styles.dayDot, { backgroundColor: dot }]} /> : <View style={styles.dayDotEmpty} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}

        {/* Selected day detail */}
        <View style={styles.dayHeaderRow}>
          <Text style={styles.dayHeaderText}>{selectedLabel}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {selectedPlans.length === 0 ? (
          <Text style={styles.restText}>No workouts planned. Tap + to add one.</Text>
        ) : (
          selectedPlans.map((p) => {
            const completed = p.isCompleted ?? p.IsCompleted;
            const missed = selectedKey < todayStr && !completed;
            return (
              <TouchableOpacity
                key={p.planId ?? p.PlanId}
                style={[styles.planPill, completed && styles.planDone, missed && styles.planMissed]}
                onPress={() => planActions(p)}
                activeOpacity={0.8}
              >
                <ActivityIcon activityTypeId={p.activityTypeId ?? p.ActivityTypeId} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName} numberOfLines={1}>
                    {activityName(p.activityTypeId ?? p.ActivityTypeId)}
                    {(p.plannedDuration ?? p.PlannedDuration) ? ` · ${p.plannedDuration ?? p.PlannedDuration}m` : ''}
                    {(p.plannedDistance ?? p.PlannedDistance) ? ` · ${p.plannedDistance ?? p.PlannedDistance}km` : ''}
                  </Text>
                  {(p.notes ?? p.Notes) ? (
                    <Text style={styles.planNote} numberOfLines={1}>{p.notes ?? p.Notes}</Text>
                  ) : null}
                  {(p.createdByCoach ?? p.CreatedByCoach) ? (
                    <Text style={styles.coachTag}>From coach</Text>
                  ) : null}
                </View>
                {completed ? (
                  <Ionicons name="checkmark-circle" size={20} color="#00e676" />
                ) : missed ? (
                  <Ionicons name="close-circle" size={20} color={Colors.danger} />
                ) : (
                  <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add / edit modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={[styles.backdrop, { paddingBottom: keyboardHeight }]} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>
                {editingPlan ? 'Edit planned workout' : 'Plan a workout'}
                {` · ${selectedDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}`}
              </Text>

              <Text style={styles.label}>Activity</Text>
              <ComboBox
                items={activityTypes}
                selectedValue={activity?.activityTypeID}
                onChange={setActivity}
                labelKey="typeName"
                valueKey="activityTypeID"
                placeholder="Select activity"
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Duration (min)</Text>
                  <TextInput
                    style={styles.input}
                    value={duration}
                    onChangeText={setDuration}
                    keyboardType="numeric"
                    placeholder="45"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Distance (km)</Text>
                  <TextInput
                    style={styles.input}
                    value={distance}
                    onChangeText={setDistance}
                    keyboardType="decimal-pad"
                    placeholder="optional"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. easy zone-2 run"
                placeholderTextColor={Colors.textMuted}
                multiline
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editingPlan ? 'Save' : 'Add'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Complete modal — asks exertion, then logs a real workout */}
      <Modal visible={!!completePlan} transparent animationType="slide" onRequestClose={() => setCompletePlan(null)}>
        <Pressable style={[styles.backdrop, { paddingBottom: keyboardHeight }]} onPress={() => setCompletePlan(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Complete workout</Text>
            {completePlan && (
              <Text style={styles.completeSub}>
                {activityName(completePlan.activityTypeId ?? completePlan.ActivityTypeId)} · logs to your Health tab
              </Text>
            )}

            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Duration (min)</Text>
                <TextInput
                  style={styles.input}
                  value={compDuration}
                  onChangeText={setCompDuration}
                  keyboardType="numeric"
                  placeholder="45"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Distance (km)</Text>
                <TextInput
                  style={styles.input}
                  value={compDistance}
                  onChangeText={setCompDistance}
                  keyboardType="decimal-pad"
                  placeholder="optional"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <Text style={styles.label}>Exertion level: {compExertion} / 10</Text>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={compExertion}
              onValueChange={setCompExertion}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={Colors.primary}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>Easy</Text>
              <Text style={styles.sliderLabelText}>Max effort</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCompletePlan(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={confirmComplete} disabled={completing}>
                {completing ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Log workout</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  monthLabel: { color: C.textPrimary, fontSize: 18, fontWeight: '800' },
  scroll: { paddingHorizontal: 12, paddingBottom: 40 },

  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  weekCellText: { color: C.textMuted, fontSize: 12, fontWeight: '800' },

  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    margin: 2,
  },
  dayCellSelected: { backgroundColor: C.primary },
  dayCellToday: { borderWidth: 1.5, borderColor: C.primary },
  dayNum: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
  dayNumSelected: { color: '#fff', fontWeight: '900' },
  dayNumToday: { color: C.primary },
  dayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  dayDotEmpty: { width: 6, height: 6, marginTop: 3 },

  dayHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 18, marginBottom: 8, paddingHorizontal: 4,
  },
  dayHeaderText: { color: C.textPrimary, fontSize: 16, fontWeight: '900' },
  addBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  restText: { color: C.textMuted, fontSize: 13, fontStyle: 'italic', paddingVertical: 8, paddingHorizontal: 4 },
  planPill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.cardBackground, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  planDone: { borderColor: '#00e676' },
  planMissed: { opacity: 0.7, borderColor: C.danger },
  planName: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  planNote: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  coachTag: { color: C.primary, fontSize: 10, fontWeight: '700', marginTop: 1 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.cardBackground, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 30, borderWidth: 1, borderColor: C.border, maxHeight: '88%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '900', marginBottom: 6 },
  completeSub: { color: C.textSecondary, fontSize: 13, marginBottom: 6 },
  label: { color: C.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: C.inputBackground, borderRadius: 10, padding: 12, color: C.textPrimary,
    borderWidth: 1, borderColor: C.inputBorder, fontSize: 15,
  },
  rowInputs: { flexDirection: 'row', gap: 12 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabelText: { color: C.textMuted, fontSize: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
  cancelText: { color: C.textSecondary, fontSize: 15, fontWeight: '800' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: C.primary },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default TrainingCalendarScreen;
