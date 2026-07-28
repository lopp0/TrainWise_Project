import React, { useEffect, useState } from 'react';
import ScreenTutorial from '../components/ScreenTutorial';
import { isTutorialDone, markTutorialDone } from '../utils/tutorialManager';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import { getAllActivityTypes, createProgram, updateProgram, assignProgram } from '../services/api';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #133 — Coach builds a reusable WEEKLY program. Each row is a workout on a day
 * of the week (Sun→Sat); the whole weekly pattern repeats for the chosen number
 * of weeks when assigned. There is no per-workout "week" — one workout per day
 * (#12), and the pattern repeats across all weeks (#3/#4).
 *
 * Pass route.params.program to EDIT an existing program (#2).
 */
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // index = dayOfWeek, 0=Sun

const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// The upcoming Sunday, so week 1 starts on a Sunday and day 0 lines up (#6/#8).
const nextSundayIso = () => {
  const d = new Date();
  const delta = (7 - d.getDay()) % 7 || 7; // days until the next Sunday
  d.setDate(d.getDate() + delta);
  return toIso(d);
};

// Icon per activity so the chips are scannable (#7).
const activityIcon = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('run') || n.includes('interval') || n.includes('treadmill')) return 'walk';
  if (n.includes('walk') || n.includes('hik') || n.includes('stair') || n.includes('nordic')) return 'footsteps';
  if (n.includes('cycl') || n.includes('bike') || n.includes('spin')) return 'bicycle';
  if (n.includes('swim')) return 'water';
  if (n.includes('yoga') || n.includes('pilates') || n.includes('mobility') || n.includes('balance') || n.includes('flex')) return 'body';
  if (n.includes('row')) return 'boat';
  if (n.includes('elliptical')) return 'infinite';
  if (n.includes('gym') || n.includes('strength') || n.includes('power') || n.includes('lift') || n.includes('crossfit') || n.includes('hiit')) return 'barbell';
  return 'fitness';
};

const PROGRAM_BUILDER_TUTORIAL_STEPS = [
  {
    icon: '🗓️',
    title: 'Build a Weekly Plan',
    body: 'Create a workout pattern that repeats every week. Set how many weeks the whole program should run for.',
  },
  {
    icon: '➕',
    title: 'Add a Workout',
    body: 'Tap "Add workout" to place a session on a day. Choose the day, the activity type, and how long it should take.',
  },
  {
    icon: '📌',
    title: 'One Workout Per Day',
    body: "Each day can only have one workout in the weekly pattern. Pick a different day if one is already taken.",
  },
  {
    icon: '✅',
    title: 'Save or Assign',
    body: 'Save the program to reuse later, or assign it directly to a trainee — it will start on their calendar next Sunday.',
  },
];

const ProgramBuilderScreen = ({ route, navigation }) => {
  const coachUserId = route?.params?.coachUserId;
  const editing = route?.params?.program || null; // existing program to edit
  const assignToTrainee = route?.params?.assignToTrainee || null; // { userID, fullName }
  const styles = useThemedStyles(makeStyles);
  const traineeId = assignToTrainee?.userID ?? assignToTrainee?.UserID;
  const traineeName = assignToTrainee?.fullName ?? assignToTrainee?.FullName ?? 'trainee';

  const [activityTypes, setActivityTypes] = useState([]);
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    isTutorialDone('programBuilder').then((d) => { if (!d) setShowTutorial(true); });
  }, []);
  const [name, setName] = useState(editing?.name ?? editing?.Name ?? '');
  const [description, setDescription] = useState(editing?.description ?? editing?.Description ?? '');
  const [weeks, setWeeks] = useState(editing?.durationWeeks ?? editing?.DurationWeeks ?? 4);
  const [rows, setRows] = useState(() => {
    const src = editing?.workouts ?? editing?.Workouts ?? [];
    const byDay = new Map();
    src.forEach((w) => {
      const day = w.dayOfWeek ?? w.DayOfWeek ?? 0;
      if (!byDay.has(day)) {
        byDay.set(day, {
          day,
          activityTypeId: w.activityTypeID ?? w.ActivityTypeID ?? 1,
          duration: String(w.duration ?? w.Duration ?? 45),
          notes: w.notes ?? w.Notes ?? '',
        });
      }
    });
    return [...byDay.values()];
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllActivityTypes()
      .then((r) => setActivityTypes(r.data || []))
      .catch(() => setActivityTypes([{ activityTypeID: 1, typeName: 'Running' }]));
  }, []);

  const clampWeeks = (n) => Math.max(1, Math.min(52, n));

  const addRow = () => {
    // Default to the first weekday not already used (one workout per day, #12).
    const used = new Set(rows.map((r) => r.day));
    let day = 0;
    while (used.has(day) && day < 6) day += 1;
    if (used.has(day)) { Alert.alert('Week is full', 'You already have a workout on every day.'); return; }
    setRows((prev) => [
      ...prev,
      { day, activityTypeId: activityTypes[0]?.activityTypeID ?? 1, duration: '45', notes: '' },
    ]);
  };

  const updateRow = (i, patch) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  // Selecting a day that another row already uses would create two workouts on
  // one day — block it (#12).
  const setDay = (i, day) => {
    if (rows.some((r, idx) => idx !== i && r.day === day)) {
      Alert.alert('Day already used', 'There is already a workout on that day. One workout per day.');
      return;
    }
    updateRow(i, { day });
  };

  // Save (create or update). When `thenAssign` and we have a trainee, the SAME
  // tap also assigns the program starting the next Sunday (#8 — no date prompt).
  const save = async (thenAssign) => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Name required', 'Give the program a name.'); return; }
    if (rows.length === 0) { Alert.alert('Add a workout', 'A program needs at least one workout.'); return; }
    try {
      setSaving(true);
      const payload = {
        name: trimmed,
        description: description.trim() || null,
        durationWeeks: weeks,
        workouts: rows.map((r) => ({
          dayOfWeek: Math.max(0, Math.min(6, Number(r.day) || 0)),
          activityTypeId: r.activityTypeId,
          duration: r.duration ? Math.max(1, Math.min(600, parseInt(r.duration, 10) || 0)) : null,
          notes: r.notes?.trim() || null,
        })),
      };

      let programId;
      if (editing) {
        programId = editing.programID ?? editing.ProgramID;
        await updateProgram(programId, payload);
      } else {
        const res = await createProgram(coachUserId, payload);
        programId = res.data?.programId ?? res.data?.ProgramId;
      }

      if (thenAssign && traineeId) {
        await assignProgram(programId, { traineeUserId: traineeId, startDate: nextSundayIso() });
        Alert.alert('Assigned', `"${trimmed}" is now on ${traineeName}'s calendar (starts next Sunday).`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert(editing ? 'Program updated' : 'Program created', `"${trimmed}" was saved.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data || e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const activityName = (id) => activityTypes.find((a) => a.activityTypeID === id)?.typeName || 'Activity';

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={editing ? 'Edit program' : 'New program'}
        subtitle="A weekly plan that repeats"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text style={styles.label}>Program name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. 4-Week Base Builder"
            placeholderTextColor={Colors.textMuted}
            maxLength={120}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, { height: 64, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="What is this program for?"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
          />

          <Text style={styles.label}>Repeat for</Text>
          <View style={styles.stepRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setWeeks((w) => clampWeeks(w - 1))}>
              <Ionicons name="remove" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{weeks} week{weeks > 1 ? 's' : ''}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setWeeks((w) => clampWeeks(w + 1))}>
              <Ionicons name="add" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hintLine}>The weekly plan below repeats every week for {weeks} week{weeks > 1 ? 's' : ''}.</Text>

          <View style={styles.workoutsHead}>
            <Text style={styles.sectionTitle}>Weekly plan ({rows.length})</Text>
            <TouchableOpacity style={styles.addBtn} onPress={addRow} activeOpacity={0.85}>
              <Ionicons name="add-circle" size={18} color={Colors.primary} />
              <Text style={styles.addBtnText}>Add workout</Text>
            </TouchableOpacity>
          </View>

          {rows.length === 0 && (
            <Text style={styles.emptyHint}>No workouts yet. Tap "Add workout" to place a session on a day.</Text>
          )}

          {rows
            .slice()
            .sort((a, b) => a.day - b.day)
            .map((r) => {
              const i = rows.indexOf(r);
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons name={activityIcon(activityName(r.activityTypeId))} size={16} color={Colors.primary} />
                      <Text style={styles.cardTitle}>{activityName(r.activityTypeId)} · {DAY_LABELS[r.day]}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeRow(i)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>

                  {/* day chips (Sun→Sat) */}
                  <Text style={styles.miniLabel}>Day</Text>
                  <View style={styles.dayRow}>
                    {DAY_LABELS.map((d, di) => (
                      <TouchableOpacity
                        key={di}
                        style={[styles.dayChip, r.day === di && styles.dayChipActive]}
                        onPress={() => setDay(i, di)}
                      >
                        <Text style={[styles.dayChipText, r.day === di && styles.dayChipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* activity chips with icons */}
                  <Text style={styles.miniLabel}>Activity</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actScroll} keyboardShouldPersistTaps="handled">
                    {activityTypes.map((a) => {
                      const active = r.activityTypeId === a.activityTypeID;
                      return (
                        <TouchableOpacity
                          key={a.activityTypeID}
                          style={[styles.actChip, active && styles.actChipActive]}
                          onPress={() => updateRow(i, { activityTypeId: a.activityTypeID })}
                        >
                          <Ionicons name={activityIcon(a.typeName)} size={14} color={active ? '#0A1628' : Colors.textSecondary} />
                          <Text style={[styles.actChipText, active && styles.actChipTextActive]}>{a.typeName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.rowInline}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>Minutes</Text>
                      <TextInput
                        style={styles.inputSmall}
                        value={String(r.duration)}
                        onChangeText={(t) => updateRow(i, { duration: t.replace(/[^0-9]/g, '') })}
                        keyboardType="number-pad"
                        maxLength={3}
                      />
                    </View>
                    <View style={{ flex: 2, marginLeft: 10 }}>
                      <Text style={styles.miniLabel}>Notes</Text>
                      <TextInput
                        style={styles.inputSmall}
                        value={r.notes}
                        onChangeText={(t) => updateRow(i, { notes: t })}
                        placeholder="Optional"
                        placeholderTextColor={Colors.textMuted}
                        maxLength={500}
                      />
                    </View>
                  </View>
                </View>
              );
            })}

          {assignToTrainee ? (
            <>
              <PrimaryButton
                title={saving ? 'Saving…' : `Assign to ${traineeName.split(' ')[0]}`}
                onPress={() => save(true)}
                loading={saving}
              />
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => save(false)} disabled={saving}>
                <Text style={styles.secondaryText}>Save without assigning</Text>
              </TouchableOpacity>
            </>
          ) : (
            <PrimaryButton
              title={saving ? 'Saving…' : editing ? 'Save changes' : 'Create program'}
              onPress={() => save(false)}
              loading={saving}
            />
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <ScreenTutorial
        visible={showTutorial}
        steps={PROGRAM_BUILDER_TUTORIAL_STEPS}
        onFinish={() => { setShowTutorial(false); markTutorialDone('programBuilder'); }}
      />
    </View>
  );
};

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { padding: 16, paddingBottom: 40 },
  label: { color: C.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: C.inputBackground, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: C.textPrimary, fontSize: 15, borderWidth: 1, borderColor: C.inputBorder,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.cardBackground,
  },
  stepValue: { color: C.textPrimary, fontSize: 16, fontWeight: '800', minWidth: 90, textAlign: 'center' },
  hintLine: { color: C.textMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  workoutsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8 },
  sectionTitle: { color: C.primary, fontSize: 16, fontWeight: '800' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { color: C.primary, fontSize: 13, fontWeight: '700' },
  emptyHint: { color: C.textMuted, fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  card: {
    backgroundColor: C.cardBackground, borderRadius: 12, padding: 14, marginTop: 10,
    borderWidth: 1, borderColor: C.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  cardTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '800' },
  miniLabel: { color: C.textMuted, fontSize: 11, marginTop: 10, marginBottom: 4 },
  dayRow: { flexDirection: 'row', gap: 4 },
  dayChip: {
    flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.cardBackgroundLight,
  },
  dayChipActive: { borderColor: C.primary, backgroundColor: C.primary },
  dayChipText: { color: C.textSecondary, fontSize: 11, fontWeight: '700' },
  dayChipTextActive: { color: '#0A1628' },
  actScroll: { flexGrow: 0 },
  actChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginRight: 6,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.cardBackgroundLight,
  },
  actChipActive: { borderColor: C.primary, backgroundColor: C.primary },
  actChipText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
  actChipTextActive: { color: '#0A1628' },
  rowInline: { flexDirection: 'row', marginTop: 2 },
  inputSmall: {
    backgroundColor: C.inputBackground, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: C.inputBorder,
  },
  secondaryBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  secondaryText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
});

export default ProgramBuilderScreen;
