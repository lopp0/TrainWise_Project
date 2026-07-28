import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../api/AuthContext';
import { getProgramAssignment, deleteAssignment, getAllActivityTypes } from '../services/api';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #133 — One assignment's plan (shared by coach and trainee). Shows the weekly
 * schedule, a button into the per-program chat, and (for the coach) unassign.
 * The workouts also live on the trainee's calendar; this is the plan overview.
 */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ProgramDetailScreen = ({ route, navigation }) => {
  const assignmentId = route?.params?.assignmentId;
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);

  const [data, setData] = useState(null);       // { assignment, program }
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!assignmentId) { setLoading(false); return; }
    try {
      const [res, t] = await Promise.all([
        getProgramAssignment(assignmentId),
        getAllActivityTypes().catch(() => ({ data: [] })),
      ]);
      setData(res.data || null);
      setTypes(t.data || []);
    } catch (e) {
      Alert.alert('Could not load', e?.response?.data || e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Program" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      </View>
    );
  }

  const assignment = data?.assignment || {};
  const program = data?.program || {};
  const coachUserId = assignment.coachUserID ?? assignment.CoachUserID;
  const isCoach = userId === coachUserId;
  const programName = program.name ?? program.Name ?? assignment.programName ?? 'Program';
  const weeks = program.durationWeeks ?? program.DurationWeeks ?? assignment.durationWeeks ?? 0;
  const startDate = assignment.startDate ?? assignment.StartDate;
  const workouts = program.workouts ?? program.Workouts ?? [];

  const typeName = (id) => types.find((a) => a.activityTypeID === id)?.typeName || 'Workout';

  // group workouts by week
  const byWeek = {};
  workouts.forEach((w) => {
    const wk = w.weekNumber ?? w.WeekNumber;
    (byWeek[wk] = byWeek[wk] || []).push(w);
  });
  const weekKeys = Object.keys(byWeek).map(Number).sort((a, b) => a - b);

  // #11 — chat about the program in the SAME 1:1 coach↔trainee conversation
  // that already exists (not a separate thread). Peer = the other party.
  const openChat = () => {
    const traineeUserId = assignment.traineeUserID ?? assignment.TraineeUserID;
    const peerId = isCoach ? traineeUserId : coachUserId;
    const peerName = isCoach
      ? (assignment.traineeName ?? assignment.TraineeName ?? 'Trainee')
      : (assignment.coachName ?? assignment.CoachName ?? 'Coach');
    navigation.navigate('Chat', { selfId: userId, peerId, peerName, peerImagePath: null });
  };

  const onUnassign = () => {
    Alert.alert('Remove program?', 'This removes the assigned sessions from the calendar and deletes the program chat.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await deleteAssignment(assignmentId);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Could not remove', e?.response?.data || e.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={programName} subtitle={`${weeks} week${weeks > 1 ? 's' : ''} program`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.summary}>
          <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.summaryText}>
            {isCoach
              ? `Assigned to ${assignment.traineeName ?? assignment.TraineeName ?? 'trainee'}`
              : `Coach: ${assignment.coachName ?? assignment.CoachName ?? 'your coach'}`}
          </Text>
        </View>
        {!!startDate && (
          <View style={styles.summary}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.summaryText}>Starts {new Date(startDate).toLocaleDateString()}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.chatBtn} onPress={openChat} activeOpacity={0.9}>
          <Ionicons name="chatbubbles-outline" size={18} color="#0A1628" />
          <Text style={styles.chatBtnText}>Program chat</Text>
        </TouchableOpacity>

        {weekKeys.map((wk) => (
          <View key={wk} style={styles.weekBlock}>
            <Text style={styles.weekTitle}>Week {wk}</Text>
            {byWeek[wk]
              .slice()
              .sort((a, b) => (a.dayOfWeek ?? a.DayOfWeek) - (b.dayOfWeek ?? b.DayOfWeek))
              .map((w, i) => {
                const day = w.dayOfWeek ?? w.DayOfWeek;
                const dur = w.duration ?? w.Duration;
                const notes = w.notes ?? w.Notes;
                return (
                  <View key={i} style={styles.workoutRow}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>{DAY_LABELS[day] || '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workoutTitle}>
                        {typeName(w.activityTypeID ?? w.ActivityTypeID)}
                        {dur ? ` · ${dur} min` : ''}
                      </Text>
                      {!!notes && <Text style={styles.workoutNotes}>{notes}</Text>}
                    </View>
                  </View>
                );
              })}
          </View>
        ))}

        {isCoach && (
          <TouchableOpacity style={styles.unassignBtn} onPress={onUnassign} activeOpacity={0.85}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            <Text style={styles.unassignText}>Remove this assignment</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { padding: 16, paddingBottom: 40 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  summaryText: { color: C.textSecondary, fontSize: 14 },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, marginTop: 8, marginBottom: 18,
  },
  chatBtnText: { color: '#0A1628', fontSize: 15, fontWeight: '800' },
  weekBlock: {
    backgroundColor: C.cardBackground, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  weekTitle: { color: C.primary, fontSize: 14, fontWeight: '800', marginBottom: 10 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  dayBadge: {
    width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.cardBackgroundLight, borderWidth: 1, borderColor: C.border,
  },
  dayBadgeText: { color: C.textPrimary, fontSize: 12, fontWeight: '800' },
  workoutTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  workoutNotes: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  unassignBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: C.danger, borderRadius: 12, paddingVertical: 12, marginTop: 8,
  },
  unassignText: { color: C.danger, fontSize: 14, fontWeight: '700' },
});

export default ProgramDetailScreen;
