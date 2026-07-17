import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { getCalendar } from '../services/api';

/**
 * #117 — "Today's plan" card. Surfaces any planned workout scheduled for today
 * (from the training calendar) directly on Home, with a one-tap "complete"
 * action that opens AddWorkout prefilled. Self-contained: fetches its own
 * calendar slice (like SmartSuggestionCard) so Home stays simple. Renders
 * nothing when there's no plan for today.
 */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const TodayPlanCard = ({ navigation, userId }) => {
  const styles = useThemedStyles(makeStyles);
  const Colors = styles._colors;
  const [plans, setPlans] = useState([]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const today = ymd(new Date());
      const res = await getCalendar(userId, today, today);
      const rows = Array.isArray(res.data) ? res.data : [];
      // Only show plans not already completed.
      setPlans(rows.filter((p) => !(p.isCompleted ?? p.IsCompleted)));
    } catch {
      setPlans([]);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!plans.length) return null;

  const plan = plans[0];
  const title =
    plan.title ?? plan.Title ?? plan.activityName ?? plan.ActivityName ?? 'Planned workout';
  // The calendar field serializes as `activityTypeId` (lowercase 'd') — reading
  // `activityTypeID` (capital ID) silently missed it, so nothing preselected.
  const activityTypeId = plan.activityTypeId ?? plan.ActivityTypeId ?? plan.activityTypeID ?? null;
  const plannedDuration = plan.plannedDuration ?? plan.PlannedDuration ?? null;
  const plannedDistance = plan.plannedDistance ?? plan.PlannedDistance ?? null;
  const byCoach = plan.createdByCoach ?? plan.CreatedByCoach;
  const extra = plans.length - 1;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        // Open the "Already Done" tab prefilled with the coach's recommended
        // activity + duration + distance so the trainee sees and logs the plan.
        navigation.navigate('AddWorkout', {
          preselectActivityTypeId: activityTypeId,
          preselectDuration: plannedDuration,
          preselectDistance: plannedDistance,
          liveTab: false,
        })
      }
    >
      <View style={styles.iconWrap}>
        <Ionicons name="calendar" size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.row}>
          <Text style={styles.label}>TODAY’S PLAN</Text>
          {byCoach && (
            <View style={styles.coachPill}>
              <Text style={styles.coachPillText}>Coach</Text>
            </View>
          )}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {extra > 0 && <Text style={styles.more}>+{extra} more planned today</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: Colors.cardBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: 14,
      marginTop: 14,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.cardBackgroundLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    label: { color: Colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
    coachPill: {
      backgroundColor: Colors.primary,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    coachPillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 2 },
    more: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  });
  s._colors = Colors;
  return s;
};

export default TodayPlanCard;
