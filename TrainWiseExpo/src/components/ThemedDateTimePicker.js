import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * In-app, themed date + time picker (item 2) so the "Already Done" start-time
 * picker matches the app instead of the bare OS dialog. Month-grid date + a
 * simple hour/minute stepper. `maximumDate` (optional) disables future days and
 * caps the time.
 */
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const ThemedDateTimePicker = ({ visible, value, maximumDate, onConfirm, onCancel }) => {
  const styles = useThemedStyles(makeStyles);
  const Colors = styles._colors;
  const [sel, setSel] = useState(value instanceof Date ? value : new Date());
  const [cursor, setCursor] = useState(() => {
    const v = value instanceof Date ? value : new Date();
    return new Date(v.getFullYear(), v.getMonth(), 1);
  });

  useEffect(() => {
    if (visible) {
      const v = value instanceof Date ? value : new Date();
      setSel(v);
      setCursor(new Date(v.getFullYear(), v.getMonth(), 1));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const maxYmd = maximumDate ? ymd(maximumDate) : null;
  const selKey = ymd(sel);
  const isFuture = (d) => maxYmd && ymd(d) > maxYmd;

  const pickDay = (d) => {
    const nd = new Date(sel);
    nd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    if (maximumDate && nd > maximumDate) nd.setTime(maximumDate.getTime());
    setSel(nd);
  };

  const stepTime = (field, delta) => {
    const nd = new Date(sel);
    if (field === 'h') nd.setHours((nd.getHours() + delta + 24) % 24);
    else nd.setMinutes((nd.getMinutes() + delta + 60) % 60);
    if (maximumDate && nd > maximumDate) return; // don't step into the future
    setSel(nd);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.selected}>
            {sel.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} · {pad(sel.getHours())}:{pad(sel.getMinutes())}
          </Text>

          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {DAY_LABELS.map((d, i) => (
              <View key={i} style={styles.weekCell}><Text style={styles.weekCellText}>{d}</Text></View>
            ))}
          </View>

          {weeks.map((wk, wi) => (
            <View key={wi} style={styles.weekRow}>
              {wk.map((cell, ci) => {
                if (!cell) return <View key={ci} style={styles.dayCell} />;
                const future = isFuture(cell);
                const selected = ymd(cell) === selKey;
                return (
                  <TouchableOpacity
                    key={ci}
                    style={[styles.dayCell, selected && styles.daySelected]}
                    disabled={future}
                    onPress={() => pickDay(cell)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dayNum, selected && styles.dayNumSelected, future && styles.dayNumDisabled]}>
                      {cell.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Time</Text>
            <View style={styles.timeBox}>
              <TouchableOpacity onPress={() => stepTime('h', -1)} style={styles.timeBtn}><Ionicons name="remove" size={18} color={Colors.primary} /></TouchableOpacity>
              <Text style={styles.timeVal}>{pad(sel.getHours())}</Text>
              <TouchableOpacity onPress={() => stepTime('h', 1)} style={styles.timeBtn}><Ionicons name="add" size={18} color={Colors.primary} /></TouchableOpacity>
            </View>
            <Text style={styles.timeColon}>:</Text>
            <View style={styles.timeBox}>
              <TouchableOpacity onPress={() => stepTime('m', -5)} style={styles.timeBtn}><Ionicons name="remove" size={18} color={Colors.primary} /></TouchableOpacity>
              <Text style={styles.timeVal}>{pad(sel.getMinutes())}</Text>
              <TouchableOpacity onPress={() => stepTime('m', 5)} style={styles.timeBtn}><Ionicons name="add" size={18} color={Colors.primary} /></TouchableOpacity>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.okBtn} onPress={() => onConfirm(sel)}><Text style={styles.okText}>OK</Text></TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 20 },
    card: { backgroundColor: C.cardBackground, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border },
    selected: { color: C.primary, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 6 },
    monthLabel: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
    weekRow: { flexDirection: 'row' },
    weekCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
    weekCellText: { color: C.textMuted, fontSize: 11, fontWeight: '800' },
    dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, margin: 2 },
    daySelected: { backgroundColor: C.primary },
    dayNum: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
    dayNumSelected: { color: '#fff', fontWeight: '900' },
    dayNumDisabled: { color: C.textMuted, opacity: 0.4 },
    timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
    timeLabel: { color: C.textSecondary, fontSize: 13, fontWeight: '700', marginRight: 6 },
    timeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBackground, borderRadius: 10, borderWidth: 1, borderColor: C.inputBorder },
    timeBtn: { paddingHorizontal: 10, paddingVertical: 8 },
    timeVal: { color: C.textPrimary, fontSize: 18, fontWeight: '900', minWidth: 26, textAlign: 'center' },
    timeColon: { color: C.textPrimary, fontSize: 18, fontWeight: '900' },
    actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
    cancelText: { color: C.textSecondary, fontSize: 15, fontWeight: '800' },
    okBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: C.primary },
    okText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });
  s._colors = C;
  return s;
};

export default ThemedDateTimePicker;
