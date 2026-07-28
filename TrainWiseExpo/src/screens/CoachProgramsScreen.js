import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { getProgramsByCoach, deleteProgram, getProgram } from '../services/api';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #133 — Coach's program templates. Two modes:
 *  • manage (default): create / edit / delete templates.
 *  • pick (route.params.pickForTrainee set): tapping a program opens it to edit
 *    AND assign to that trainee, so the coach flows here from the trainee's page.
 */
const CoachProgramsScreen = ({ route, navigation }) => {
  const coachUserId = route?.params?.coachUserId;
  const pickForTrainee = route?.params?.pickForTrainee || null; // { userID/UserID, fullName }
  const styles = useThemedStyles(makeStyles);

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!coachUserId) { setLoading(false); return; }
    try {
      const r = await getProgramsByCoach(coachUserId);
      setPrograms(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      Alert.alert('Could not load', e?.response?.data || e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [coachUserId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const traineeName = pickForTrainee?.fullName ?? pickForTrainee?.FullName ?? 'this trainee';

  // Tapping a program opens it in the builder so the coach can modify it (#2),
  // and (in pick mode) assign it from there — no separate date prompt (#8).
  const openProgram = async (item) => {
    try {
      const res = await getProgram(item.programID ?? item.ProgramID);
      navigation.navigate('ProgramBuilder', {
        coachUserId,
        program: res.data,
        assignToTrainee: pickForTrainee || undefined,
      });
    } catch (e) {
      Alert.alert('Could not open', e?.response?.data || e.message || 'Please try again.');
    }
  };

  const onDelete = (program) => {
    const name = program.name ?? program.Name;
    Alert.alert('Delete program?', `"${name}" and any assignments made from it will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteProgram(program.programID ?? program.ProgramID);
            load();
          } catch (e) {
            Alert.alert('Could not delete', e?.response?.data || e.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const name = item.name ?? item.Name;
    const weeks = item.durationWeeks ?? item.DurationWeeks;
    const count = item.workoutCount ?? item.WorkoutCount ?? 0;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => openProgram(item)}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="barbell-outline" size={22} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{name}</Text>
          <Text style={styles.cardMeta}>{weeks} week{weeks > 1 ? 's' : ''} · {count} workout{count === 1 ? '' : 's'}</Text>
          {!!(item.description ?? item.Description) && (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description ?? item.Description}</Text>
          )}
        </View>
        {pickForTrainee ? (
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        ) : (
          <TouchableOpacity onPress={() => onDelete(item)} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={pickForTrainee ? 'Assign a program' : 'My programs'}
        subtitle={pickForTrainee ? `Pick a plan for ${traineeName}` : 'Reusable training plans'}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={programs}
          keyExtractor={(p, i) => String(p.programID ?? p.ProgramID ?? i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {pickForTrainee
                ? 'No programs yet. Create one first, then assign it.'
                : 'No programs yet. Tap "New program" to build your first plan.'}
            </Text>
          }
        />
      )}

      {/* Always available — the coach can create a template then immediately
          assign it, even when they arrived here in pick mode with none yet. */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate('ProgramBuilder', {
            coachUserId,
            // In pick mode, a freshly-created program is assigned to this trainee
            // straight from its Create button (#3).
            assignToTrainee: pickForTrainee || undefined,
          })
        }
      >
        <Ionicons name="add" size={22} color="#0A1628" />
        <Text style={styles.fabText}>New program</Text>
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.cardBackground, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.cardBackgroundLight,
  },
  cardTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  cardMeta: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  cardDesc: { color: C.textMuted, fontSize: 12, marginTop: 4 },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 60, fontSize: 14, paddingHorizontal: 30, lineHeight: 20 },
  fab: {
    position: 'absolute', bottom: 24, right: 20, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.primary, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 28,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabText: { color: '#0A1628', fontSize: 14, fontWeight: '800' },
});

export default CoachProgramsScreen;
