import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../api/AuthContext';
import { getAssignmentsForTrainee } from '../services/api';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #133 — A trainee's assigned training programs. The actual sessions also show
 * on the calendar; this lists each assigned program and opens its detail + chat.
 */
const MyProgramsScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const r = await getAssignmentsForTrainee(userId);
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      Alert.alert('Could not load', e?.response?.data || e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const renderItem = ({ item }) => {
    const name = item.programName ?? item.ProgramName;
    const coach = item.coachName ?? item.CoachName;
    const weeks = item.durationWeeks ?? item.DurationWeeks;
    const count = item.workoutCount ?? item.WorkoutCount ?? 0;
    const start = item.startDate ?? item.StartDate;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ProgramDetail', { assignmentId: item.assignmentID ?? item.AssignmentID })}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="clipboard-outline" size={22} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{name}</Text>
          <Text style={styles.cardMeta}>
            {coach ? `From ${coach} · ` : ''}{weeks} week{weeks > 1 ? 's' : ''} · {count} workout{count === 1 ? '' : 's'}
          </Text>
          {!!start && <Text style={styles.cardStart}>Starts {new Date(start).toLocaleDateString()}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="My programs" subtitle="Assigned by your coach" onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a, i) => String(a.assignmentID ?? a.AssignmentID ?? i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No training programs assigned yet. When your coach assigns one, it appears here and on your calendar.
            </Text>
          }
        />
      )}
    </View>
  );
};

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  list: { padding: 16, paddingBottom: 40 },
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
  cardStart: { color: C.textMuted, fontSize: 12, marginTop: 3 },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 60, fontSize: 14, paddingHorizontal: 30, lineHeight: 20 },
});

export default MyProgramsScreen;
