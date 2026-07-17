import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, LayoutAnimation } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #167 — Daily calorie-balance ring (Home dashboard widget).
 *
 * MyFitnessPal-style energy budget: Base goal + Exercise burned − Food eaten =
 * Remaining. The ring fills with food intake toward the day's allowance
 * (goal + calories burned in today's workouts) and turns amber once you go over.
 * Food is logged locally (utils/calorieLog); workout calories come from the day's
 * logs. Pure client-side, so it degrades to Base goal only when there's no
 * workout-calorie data yet.
 *
 * props: { goal, intake, burned, onAdd(kcal), onReset(), onSetGoal(goal) }
 */
const SIZE = 148;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const QUICK_ADDS = [100, 250, 500];
const WATER_ADDS = [250, 500, 750];

const CalorieRing = ({
  goal = 0, intake = 0, burned = 0, water = 0, waterGoal = 2500,
  onAdd, onAddWater, onReset, onSetGoal, onOpenDetail,
}) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const [custom, setCustom] = useState('');
  const [open, setOpen] = useState(false); // #6 foldable (closed by default)
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  const allowance = Math.max(1, goal + burned);
  const remaining = goal + burned - intake;
  const over = remaining < 0;
  const fraction = Math.max(0, Math.min(1, intake / allowance));
  const dash = CIRC * fraction;
  const ringColor = over ? C.warning : C.primary;

  const submitCustom = () => {
    const n = parseInt(String(custom).replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(n) && n > 0) onAdd?.(n);
    setCustom('');
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerLeft} activeOpacity={0.7} onPress={toggle}>
          <Ionicons name="flame-outline" size={15} color={C.primary} />
          <Text style={styles.headerText}>NUTRITION & HYDRATION</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {onOpenDetail && (
            <TouchableOpacity onPress={onOpenDetail} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="nutrition-outline" size={17} color={C.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="refresh" size={16} color={C.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {open && (
        <>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={C.cardBackgroundLight}
            strokeWidth={STROKE}
            fill="none"
          />
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
          <Text style={[styles.remainNum, over && { color: C.warning }]}>
            {Math.abs(Math.round(remaining))}
          </Text>
          <Text style={styles.remainLabel}>{over ? 'over budget' : 'kcal left'}</Text>
        </View>
      </View>

      {/* Base + Exercise − Food breakdown */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{Math.round(goal)}</Text>
          <Text style={styles.statLabel}>Base</Text>
        </View>
        <Text style={styles.op}>+</Text>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: C.success }]}>{Math.round(burned)}</Text>
          <Text style={styles.statLabel}>Exercise</Text>
        </View>
        <Text style={styles.op}>−</Text>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: C.primary }]}>{Math.round(intake)}</Text>
          <Text style={styles.statLabel}>Food</Text>
        </View>
      </View>

      {/* Daily goal stepper */}
      <View style={styles.goalRow}>
        <Text style={styles.goalLabel}>Daily goal</Text>
        <TouchableOpacity style={styles.goalStep} onPress={() => onSetGoal?.(goal - 50)} activeOpacity={0.8}>
          <Text style={styles.goalStepText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.goalVal}>{Math.round(goal)}</Text>
        <TouchableOpacity style={styles.goalStep} onPress={() => onSetGoal?.(goal + 50)} activeOpacity={0.8}>
          <Text style={styles.goalStepText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Log food eaten */}
      <Text style={styles.logLabel}>Log food eaten</Text>
      <View style={styles.quickRow}>
        {QUICK_ADDS.map((v) => (
          <TouchableOpacity key={v} style={styles.quickBtn} onPress={() => onAdd?.(v)} activeOpacity={0.85}>
            <Text style={styles.quickText}>+{v}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.customWrap}>
          <TextInput
            style={styles.customInput}
            value={custom}
            onChangeText={setCustom}
            placeholder="kcal"
            placeholderTextColor={C.textMuted}
            keyboardType="number-pad"
            maxLength={5}
            onSubmitEditing={submitCustom}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={submitCustom} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* #2b — hydration, in the same card so nutrition + water live in one place */}
      <View style={styles.hydrationHeader}>
        <View style={styles.hydrationLabelRow}>
          <Ionicons name="water" size={15} color="#39a0ff" />
          <Text style={styles.hydrationLabel}>Hydration</Text>
        </View>
        <Text style={styles.hydrationValue}>
          {(water / 1000).toFixed(2)}L / {(waterGoal / 1000).toFixed(1)}L
        </Text>
      </View>
      <View style={styles.waterTrack}>
        <View
          style={[
            styles.waterFill,
            { width: `${Math.max(0, Math.min(1, water / Math.max(1, waterGoal))) * 100}%` },
          ]}
        />
      </View>
      <View style={styles.waterRow}>
        {WATER_ADDS.map((ml) => (
          <TouchableOpacity key={ml} style={styles.waterBtn} onPress={() => onAddWater?.(ml)} activeOpacity={0.85}>
            <Ionicons name="water-outline" size={14} color="#39a0ff" />
            <Text style={styles.waterBtnText}>+{ml}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* One tap to the full logger (barcode scan, today's list, per-item delete) */}
      {onOpenDetail && (
        <TouchableOpacity style={styles.detailBtn} onPress={onOpenDetail} activeOpacity={0.85}>
          <Ionicons name="barcode-outline" size={16} color={C.primary} />
          <Text style={styles.detailBtnText}>Scan barcode · full food log</Text>
        </TouchableOpacity>
      )}
        </>
      )}
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    card: {
      backgroundColor: C.cardBackground,
      borderRadius: 16,
      padding: 16,
      marginTop: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headerText: { color: C.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },

    ringWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 6 },
    ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    remainNum: { color: C.textPrimary, fontSize: 34, fontWeight: '900' },
    remainLabel: { color: C.textMuted, fontSize: 12, fontWeight: '700', marginTop: -2 },

    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 14,
    },
    stat: { alignItems: 'center', minWidth: 54 },
    statVal: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
    statLabel: { color: C.textMuted, fontSize: 11, marginTop: 1 },
    op: { color: C.textSecondary, fontSize: 18, fontWeight: '800' },

    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 14,
    },
    goalLabel: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
    goalStep: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.inputBackground,
      borderWidth: 1,
      borderColor: C.inputBorder,
    },
    goalStepText: { color: C.primary, fontSize: 20, fontWeight: '900' },
    goalVal: { color: C.textPrimary, fontSize: 16, fontWeight: '800', minWidth: 52, textAlign: 'center' },

    logLabel: { color: C.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 },
    quickRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    quickBtn: {
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: C.inputBackground,
      borderWidth: 1,
      borderColor: C.inputBorder,
    },
    quickText: { color: C.textPrimary, fontSize: 13, fontWeight: '800' },
    customWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.inputBackground,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.inputBorder,
      paddingLeft: 10,
    },
    customInput: { flex: 1, color: C.textPrimary, fontSize: 14, fontWeight: '700', paddingVertical: 8 },
    addBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      margin: 3,
    },

    // #2b hydration
    hydrationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      marginBottom: 8,
    },
    hydrationLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    hydrationLabel: { color: C.textSecondary, fontSize: 13, fontWeight: '800' },
    hydrationValue: { color: C.textMuted, fontSize: 12, fontWeight: '700' },
    waterTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: C.cardBackgroundLight,
      overflow: 'hidden',
    },
    waterFill: { height: '100%', backgroundColor: '#39a0ff', borderRadius: 5 },
    waterRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    waterBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: C.inputBackground,
      borderWidth: 1,
      borderColor: C.inputBorder,
    },
    waterBtnText: { color: C.textPrimary, fontSize: 13, fontWeight: '800' },

    detailBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 14,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: C.primary,
    },
    detailBtnText: { color: C.primary, fontSize: 13, fontWeight: '800' },
  });
  s._colors = C;
  return s;
};

export default CalorieRing;
