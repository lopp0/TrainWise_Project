import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { GOAL_TYPES, getGoal, setGoal, clearGoal, computeGoalProgress, suggestTarget } from '../utils/goals';

/**
 * #180 — Goal setting & tracking (Home dashboard widget). Shows a progress ring
 * for the user's active weekly goal (filled from this week's logs) with an inline
 * editor to pick the goal type + target. Self-contained: loads/saves its own goal.
 *
 * props: { userId, logs }
 */
const SIZE = 120;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const TYPE_KEYS = Object.keys(GOAL_TYPES);

const GoalCard = ({ userId, logs }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const [goal, setGoalState] = useState(null);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false); // #6 foldable (closed by default)
  const [draftType, setDraftType] = useState('weekly_load');
  const [draftTarget, setDraftTarget] = useState(GOAL_TYPES.weekly_load.defaultTarget);

  const load = useCallback(async () => {
    const g = await getGoal(userId);
    setGoalState(g);
    if (g) {
      setDraftType(g.type);
      setDraftTarget(g.target);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const progress = goal ? computeGoalProgress(goal, logs) : null;

  const openEditor = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!goal) {
      setDraftType('weekly_load');
      setDraftTarget(suggestTarget('weekly_load', logs)); // #3 adaptive default
    }
    setOpen(true);
    setEditing(true);
  };
  const pickType = (t) => {
    setDraftType(t);
    setDraftTarget(suggestTarget(t, logs)); // #3 adaptive default per type
  };
  const stepTarget = (dir) => {
    const meta = GOAL_TYPES[draftType];
    setDraftTarget((v) => Math.max(meta.min, Math.round((v || 0) + dir * meta.step)));
  };
  const save = async () => {
    const g = { type: draftType, target: draftTarget };
    await setGoal(userId, g);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditing(false);
    load();
  };
  const remove = async () => {
    await clearGoal(userId);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditing(false);
    setGoalState(null);
  };

  const frac = progress?.fraction ?? 0;
  const dash = CIRC * frac;
  const ringColor = progress?.complete ? '#00e676' : C.primary;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerLeft}
          activeOpacity={0.7}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setOpen((o) => !o);
          }}
        >
          <Ionicons name="flag-outline" size={15} color={C.primary} />
          <Text style={styles.headerText}>WEEKLY GOAL</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={openEditor} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={goal ? 'create-outline' : 'add-circle-outline'} size={18} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setOpen((o) => !o);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {open && !goal && !editing && (
        <TouchableOpacity style={styles.emptyBtn} onPress={openEditor} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color={C.primary} />
          <Text style={styles.emptyText}>Set a weekly goal</Text>
        </TouchableOpacity>
      )}

      {open && goal && !editing && progress && (
        <View style={styles.progressRow}>
          <View style={styles.ringWrap}>
            <Svg width={SIZE} height={SIZE}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={C.cardBackgroundLight} strokeWidth={STROKE} fill="none" />
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={ringColor}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${CIRC - dash}`}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={styles.pct}>{Math.round(frac * 100)}%</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.goalLabel}>{progress.meta.label}</Text>
            <Text style={styles.goalValue}>
              {progress.value}
              <Text style={styles.goalTarget}> / {progress.target} {progress.meta.unit}</Text>
            </Text>
            {progress.complete ? (
              <View style={styles.doneRow}>
                <Ionicons name="checkmark-circle" size={16} color="#00e676" />
                <Text style={styles.doneText}>Goal reached this week</Text>
              </View>
            ) : (
              <Text style={styles.remainText}>
                {Math.round((progress.target - progress.value) * 10) / 10} {progress.meta.unit} to go
              </Text>
            )}
          </View>
        </View>
      )}

      {open && editing && (
        <View style={styles.editor}>
          <Text style={styles.editorLabel}>Goal type</Text>
          <View style={styles.typeRow}>
            {TYPE_KEYS.map((t) => {
              const active = draftType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => pickType(t)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                    {GOAL_TYPES[t].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.editorLabel}>Target</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => stepTarget(-1)}>
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepVal}>{draftTarget} {GOAL_TYPES[draftType].unit}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => stepTarget(1)}>
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editorActions}>
            {goal && (
              <TouchableOpacity style={styles.clearBtn} onPress={remove} activeOpacity={0.85}>
                <Text style={styles.clearText}>Remove</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
              <Text style={styles.saveText}>Save goal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    card: { backgroundColor: C.cardBackground, borderRadius: 16, padding: 16, marginTop: 14, borderWidth: 1, borderColor: C.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headerText: { color: C.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    emptyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginTop: 12, paddingVertical: 12, borderRadius: 10,
      borderWidth: 1, borderColor: C.border, borderStyle: 'dashed',
    },
    emptyText: { color: C.primary, fontSize: 14, fontWeight: '700' },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
    ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
    ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    pct: { color: C.textPrimary, fontSize: 22, fontWeight: '900' },
    goalLabel: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
    goalValue: { color: C.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 2 },
    goalTarget: { color: C.textMuted, fontSize: 14, fontWeight: '700' },
    doneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    doneText: { color: '#00e676', fontSize: 12, fontWeight: '800' },
    remainText: { color: C.textMuted, fontSize: 12, marginTop: 6 },
    editor: { marginTop: 12 },
    editorLabel: { color: C.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 6 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: C.inputBorder, backgroundColor: C.inputBackground },
    typeChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    typeChipText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
    typeChipTextActive: { color: '#fff' },
    stepper: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.inputBackground, borderRadius: 10, borderWidth: 1, borderColor: C.inputBorder, paddingHorizontal: 8, paddingVertical: 6,
    },
    stepBtn: { paddingHorizontal: 16, paddingVertical: 2 },
    stepBtnText: { color: C.primary, fontSize: 22, fontWeight: '900' },
    stepVal: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
    editorActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    clearBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border },
    clearText: { color: C.textSecondary, fontSize: 14, fontWeight: '800' },
    saveBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: C.primary },
    saveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  });
  s._colors = C;
  return s;
};

export default GoalCard;
