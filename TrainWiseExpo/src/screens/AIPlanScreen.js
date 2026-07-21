import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import { getAllActivityTypes, createPlannedWorkout, getActivityLogsByUser } from '../services/api';
import { getGPTResponse } from '../api/openai';
import { buildDataContext } from '../utils/aiDataContext';
import ActivityIcon from '../components/ActivityIcon';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #154 — AI workout-plan generator. Asks the model for a JSON weekly plan from
 * the user's goal + level + recent history, validates/clamps every entry, shows
 * a preview, then writes the chosen entries to the training calendar (#117/#133).
 * The model's output is NEVER trusted directly — it is parsed and clamped before
 * any write.
 */
const GOALS = ['General fitness', 'Weight loss', 'Build endurance', 'Build muscle', '5K prep', 'Marathon prep'];
const LEVELS = [['Beginner', 1], ['Regular', 2], ['Advanced', 3]];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const INTENSITY = { easy: 3, moderate: 6, hard: 9 };

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Next calendar date (>= today) whose weekday matches the given 3-letter abbr.
const nextDateForDay = (abbr) => {
  const idx = DAY_ABBR.findIndex((d) => d.toLowerCase() === String(abbr || '').slice(0, 3).toLowerCase());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (idx < 0) return today;
  const diff = (idx - today.getDay() + 7) % 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
};

const matchActivityType = (name, types) => {
  const n = String(name || '').toLowerCase();
  let hit = types.find((t) => n.includes(String(t.typeName ?? t.TypeName).toLowerCase()))
    || types.find((t) => String(t.typeName ?? t.TypeName).toLowerCase().includes(n) && n.length > 2);
  if (!hit) hit = types.find((t) => /gym/i.test(t.typeName ?? t.TypeName)) || types[0];
  return hit || null;
};

// Parse the model output into validated plan entries. Tolerates markdown fences.
const parsePlan = (raw, types) => {
  if (!raw) return [];
  let s = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  let arr;
  try { arr = JSON.parse(s); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 7).map((item) => {
    const type = matchActivityType(item.activity ?? item.activityType ?? item.type, types);
    const intensityKey = String(item.intensity || 'moderate').toLowerCase();
    const exertion = INTENSITY[intensityKey] || 6;
    const dur = Math.max(10, Math.min(180, parseInt(item.durationMin ?? item.duration ?? 40, 10) || 40));
    const date = nextDateForDay(item.day);
    return {
      day: item.day || DAY_ABBR[date.getDay()],
      date,
      activityTypeId: type ? (type.activityTypeID ?? type.ActivityTypeID) : null,
      typeName: type ? (type.typeName ?? type.TypeName) : (item.activity || 'Workout'),
      durationMin: dur,
      intensity: intensityKey,
      exertion,
      note: String(item.note || '').slice(0, 200),
    };
  }).filter((e) => e.activityTypeId != null);
};

const AIPlanScreen = ({ navigation }) => {
  const { userId, user } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [types, setTypes] = useState([]);
  const [goal, setGoal] = useState('General fitness');
  const [level, setLevel] = useState(user?.experienceLevel || 2);
  const [days, setDays] = useState(3);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllActivityTypes().then((r) => setTypes(Array.isArray(r.data) ? r.data : [])).catch(() => setTypes([]));
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setPlan(null);
    try {
      let context = '';
      try {
        const logsRes = await getActivityLogsByUser(userId);
        context = buildDataContext(logsRes.data || [], types);
      } catch { /* history is optional */ }
      const levelName = LEVELS.find(([, v]) => v === level)?.[0] || 'Regular';
      const messages = [
        {
          role: 'system',
          content:
            'You are a certified coach generating a one-week training plan. ' +
            'Respond with ONLY a JSON array, no prose, no markdown. ' +
            'Each element: {"day":"Mon","activity":"Running","durationMin":40,"intensity":"easy|moderate|hard","note":"short cue"}. ' +
            'Spread sessions across DISTINCT days, include at least one easy/recovery day, and respect the athlete\'s level. ' +
            'Keep durations realistic (20-90 min).',
        },
        {
          role: 'user',
          content:
            `Goal: ${goal}. Level: ${levelName}. Sessions this week: ${days}.\n` +
            (context ? `My recent data:\n${context}\n` : '') +
            `Return exactly ${days} sessions as the JSON array.`,
        },
      ];
      const reply = await getGPTResponse(messages);
      const parsed = parsePlan(reply, types);
      if (parsed.length === 0) {
        Alert.alert('Could not read the plan', 'The AI response was not usable. Please try again.');
      }
      setPlan(parsed);
    } catch {
      Alert.alert('Generation failed', 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [goal, level, days, types, userId]);

  const addToCalendar = async () => {
    if (!plan || plan.length === 0) return;
    setSaving(true);
    try {
      for (const e of plan) {
        await createPlannedWorkout(userId, {
          activityTypeId: e.activityTypeId,
          plannedDate: ymd(e.date),
          plannedDuration: e.durationMin,
          plannedDistance: null,
          plannedLoad: e.durationMin * e.exertion,
          notes: e.note || `AI plan · ${e.intensity}`,
          createdByCoach: null,
        });
      }
      Alert.alert('Added to calendar', `${plan.length} sessions were added to your training calendar.`, [
        { text: 'View calendar', onPress: () => navigation.navigate('TrainingCalendar') },
        { text: 'OK' },
      ]);
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data?.toString?.() || 'Some sessions may not have been added.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>AI plan generator</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Goal</Text>
        <View style={styles.wrap}>
          {GOALS.map((g) => (
            <TouchableOpacity key={g} style={[styles.chip, goal === g && styles.chipOn]} onPress={() => setGoal(g)}>
              <Text style={[styles.chipText, goal === g && styles.chipTextOn]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Level</Text>
        <View style={styles.wrap}>
          {LEVELS.map(([lbl, v]) => (
            <TouchableOpacity key={v} style={[styles.chip, level === v && styles.chipOn]} onPress={() => setLevel(v)}>
              <Text style={[styles.chipText, level === v && styles.chipTextOn]}>{lbl}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Sessions this week</Text>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setDays((d) => Math.max(2, d - 1))}>
            <Ionicons name="remove" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.stepVal}>{days}</Text>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setDays((d) => Math.min(6, d + 1))}>
            <Ionicons name="add" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.genBtn} onPress={generate} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.genBtnText}>Generate plan</Text>
            </>
          )}
        </TouchableOpacity>

        {plan && plan.length > 0 && (
          <View style={styles.planWrap}>
            <Text style={styles.planHeading}>Suggested week</Text>
            {plan.map((e, i) => (
              <View key={i} style={styles.planRow}>
                <ActivityIcon activityTypeId={e.activityTypeId} typeName={e.typeName} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>{e.day} · {e.typeName}</Text>
                  <Text style={styles.planMeta}>{e.durationMin} min · {e.intensity}{e.note ? ` · ${e.note}` : ''}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addBtn} onPress={addToCalendar} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="calendar" size={16} color="#fff" />
                  <Text style={styles.addBtnText}>Add {plan.length} to my calendar</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.disclaimer}>Review before adding. AI plans are suggestions, not medical advice.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8,
  },
  title: { color: C.primary, fontSize: 22, fontWeight: '900', fontStyle: 'italic' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  label: { color: C.textSecondary, fontSize: 12, fontWeight: '800', marginTop: 16, marginBottom: 8, letterSpacing: 0.3 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.cardBackground },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cardBackground },
  stepVal: { color: C.textPrimary, fontSize: 22, fontWeight: '900', minWidth: 30, textAlign: 'center' },
  genBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, marginTop: 24,
  },
  genBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  planWrap: { marginTop: 22 },
  planHeading: { color: C.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginBottom: 10 },
  planRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.cardBackground,
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  planTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '800' },
  planMeta: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.success, borderRadius: 14, paddingVertical: 14, marginTop: 8,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disclaimer: { color: C.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10 },
});

export default AIPlanScreen;
