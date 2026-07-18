import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { getPainLogs, addPainLog } from '../services/api';

/**
 * #127 — daily pain-level (1-10) tracker for one injury. Shows a compact trend
 * sparkline of recent entries plus a 1-10 selector + "Log today" button.
 * Self-contained: fetches its own pain history. Collapsible to keep the
 * Active Injuries list tidy.
 */
const painColor = (lvl) => {
  if (lvl <= 3) return '#00e676';
  if (lvl <= 6) return '#ffee58';
  if (lvl <= 8) return '#ff9800';
  return '#f44336';
};

const PainTracker = ({ injuryId }) => {
  const styles = useThemedStyles(makeStyles);
  const Colors = styles._colors;
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [level, setLevel] = useState(5);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getPainLogs(injuryId);
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setLogs([]);
    }
  }, [injuryId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  const logToday = async () => {
    setSaving(true);
    try {
      await addPainLog(injuryId, level);
      await load();
    } catch {}
    finally { setSaving(false); }
  };

  const recent = logs.slice(-14);
  const latest = logs.length ? logs[logs.length - 1] : null;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.8}>
        <Ionicons name="pulse" size={14} color={Colors.primary} />
        <Text style={styles.headerText}>
          Pain tracker{latest ? ` · last ${latest.level}/10` : ''}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
      </TouchableOpacity>

      {open && (
        <>
          {recent.length > 0 ? (
            <View style={styles.spark}>
              {recent.map((p) => (
                <View
                  key={p.painLogID ?? p.PainLogID}
                  style={[
                    styles.bar,
                    { height: 6 + (p.level / 10) * 38, backgroundColor: painColor(p.level) },
                  ]}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>No pain logged yet. Log daily to see the trend.</Text>
          )}

          <View style={styles.controls}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setLevel((l) => Math.max(1, l - 1))}>
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <View style={[styles.levelPill, { borderColor: painColor(level) }]}>
              <Text style={[styles.levelNum, { color: painColor(level) }]}>{level}</Text>
              <Text style={styles.levelOf}>/10</Text>
            </View>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setLevel((l) => Math.min(10, l + 1))}>
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logBtn, saving && { opacity: 0.6 }]}
              onPress={logToday}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.logBtnText}>Log today</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    wrap: { marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerText: { flex: 1, color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
    spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 46, marginTop: 8 },
    bar: { flex: 1, borderRadius: 2, maxWidth: 14 },
    empty: { color: Colors.textMuted, fontSize: 11, marginTop: 8 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    stepBtn: {
      width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
      backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.inputBorder,
    },
    stepText: { color: Colors.primary, fontSize: 20, fontWeight: '800' },
    levelPill: {
      flexDirection: 'row', alignItems: 'baseline', borderWidth: 2, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 4,
    },
    levelNum: { fontSize: 18, fontWeight: '900' },
    levelOf: { color: Colors.textMuted, fontSize: 11, marginLeft: 1 },
    logBtn: {
      flex: 1, backgroundColor: Colors.primary, borderRadius: 10,
      alignItems: 'center', paddingVertical: 9,
    },
    logBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  });
  s._colors = Colors;
  return s;
};

export default PainTracker;
