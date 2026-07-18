import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { getBodyMeasurements, addBodyMeasurement } from '../services/api';

/**
 * #131 — weight & body-composition tracking. A compact card with a trend
 * sparkline of recent weigh-ins plus inputs to log a new weight (and optional
 * body-fat %). Self-contained: fetches/saves its own measurements.
 */
const WeightTracker = ({ userId }) => {
  const styles = useThemedStyles(makeStyles);
  const Colors = styles._colors;
  const [rows, setRows] = useState([]);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await getBodyMeasurements(userId);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRows([]);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w < 20 || w > 400) return;
    const bf = bodyFat ? parseFloat(bodyFat) : null;
    setSaving(true);
    try {
      await addBodyMeasurement(userId, { weight: w, bodyFat: isNaN(bf) ? null : bf });
      setWeight('');
      setBodyFat('');
      await load();
    } catch {}
    finally { setSaving(false); }
  };

  const recent = rows.slice(-16);
  const weights = recent.map((r) => Number(r.weight ?? r.Weight ?? 0));
  const min = Math.min(...weights, Infinity);
  const max = Math.max(...weights, -Infinity);
  const span = max > min ? max - min : 1;
  const latest = rows.length ? rows[rows.length - 1] : null;
  const latestW = latest ? Number(latest.weight ?? latest.Weight) : null;
  const first = rows.length ? Number(rows[0].weight ?? rows[0].Weight) : null;
  const delta = latestW != null && first != null ? latestW - first : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="scale-outline" size={16} color={Colors.primary} />
        <Text style={styles.title}>Weight tracking</Text>
        {latestW != null && (
          <Text style={styles.latest}>
            {latestW} kg
            {delta != null && delta !== 0 ? (
              <Text style={{ color: delta < 0 ? Colors.success : Colors.textMuted }}>
                {'  '}{delta < 0 ? '▼' : '▲'} {Math.abs(delta).toFixed(1)}
              </Text>
            ) : null}
          </Text>
        )}
      </View>

      {recent.length > 1 ? (
        <View style={styles.spark}>
          {weights.map((w, i) => (
            <View
              key={i}
              style={[styles.bar, { height: 8 + ((w - min) / span) * 40 }]}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Log your weight to see the trend.</Text>
      )}

      <View style={styles.inputs}>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          placeholder="Weight (kg)"
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          maxLength={5}
        />
        <TextInput
          style={styles.input}
          value={bodyFat}
          onChangeText={setBodyFat}
          placeholder="Body fat % (opt.)"
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          maxLength={4}
        />
        <TouchableOpacity
          style={[styles.logBtn, (saving || !weight) && { opacity: 0.5 }]}
          onPress={save}
          disabled={saving || !weight}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.logBtnText}>Log</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    card: {
      width: '100%',
      backgroundColor: Colors.cardBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: 14,
      marginBottom: 24,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', flex: 1 },
    latest: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
    spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 50, marginTop: 12 },
    bar: { flex: 1, borderRadius: 2, maxWidth: 14, backgroundColor: Colors.primary },
    empty: { color: Colors.textMuted, fontSize: 12, marginTop: 10 },
    inputs: { flexDirection: 'row', gap: 8, marginTop: 12 },
    input: {
      flex: 1, backgroundColor: Colors.inputBackground, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary,
      borderWidth: 1, borderColor: Colors.inputBorder, fontSize: 13,
    },
    logBtn: {
      backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    logBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  });
  s._colors = Colors;
  return s;
};

export default WeightTracker;
