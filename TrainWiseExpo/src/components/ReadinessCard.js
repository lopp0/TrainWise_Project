import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import HealthConnectService from '../api/HealthConnectService';
import { computeRecovery } from '../utils/recovery';

/**
 * #129 / #130 — Recovery / readiness Home widget.
 *
 * Reads sleep (#129) + resting HR & HRV (#130) from Health Connect, blends them
 * with the acute:chronic load ratio, and shows a 0-100 readiness score with a
 * plain-language recommendation. Degrades gracefully: when Health Connect has no
 * readiness data it shows a one-tap "connect" prompt instead of a fake score.
 *
 * props: { acRatio }
 */
const bandColor = (band, C) =>
  band === 'ready' ? C.success : band === 'moderate' ? C.warning : C.danger;
const factorColor = (status, C) =>
  status === 'good' ? C.success : status === 'warn' ? C.warning : C.danger;

const ReadinessCard = ({ acRatio = null }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(null);
  const [noData, setNoData] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [connectedOnce, setConnectedOnce] = useState(false); // #7 — tried granting already

  const load = useCallback(async () => {
    try {
      const [sleep, rhr, hrv] = await Promise.all([
        HealthConnectService.fetchSleepLastNight(),
        HealthConnectService.fetchRestingHeartRate(),
        HealthConnectService.fetchHrv(),
      ]);
      const rec = computeRecovery({
        sleepHours: sleep?.hours,
        restingHr: rhr,
        hrv,
        acRatio: typeof acRatio === 'number' ? acRatio : undefined,
      });
      setRecovery(rec);
      setNoData(rec == null);
    } catch {
      setRecovery(null);
      setNoData(true);
    } finally {
      setLoading(false);
    }
  }, [acRatio]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const connect = async () => {
    setRequesting(true);
    try {
      await HealthConnectService.requestReadinessPermissions();
      setConnectedOnce(true);
      setLoading(true);
      await load();
    } finally {
      setRequesting(false);
    }
  };

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} activeOpacity={0.8} onPress={toggle}>
        <View style={styles.headerLeft}>
          <Ionicons name="battery-charging-outline" size={15} color={C.primary} />
          <Text style={styles.headerText}>RECOVERY</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.primary} />
      </TouchableOpacity>

      {open && (
        <>
          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginVertical: 18 }} />
          ) : noData || !recovery ? (
            <View style={styles.connectWrap}>
              <Text style={styles.connectText}>
                {connectedOnce
                  ? 'No sleep or heart-rate data found in Health Connect yet. Make sure your watch/phone syncs Sleep, Resting heart rate or HRV to Health Connect, then retry.'
                  : 'Connect sleep, resting heart rate and HRV from Health Connect to see your daily readiness score.'}
              </Text>
              <TouchableOpacity style={styles.connectBtn} onPress={connect} disabled={requesting} activeOpacity={0.85}>
                {requesting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.connectBtnText}>
                    {connectedOnce ? 'Retry' : 'Connect Health Connect'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.scoreRow}>
                <View style={[styles.scoreCircle, { borderColor: bandColor(recovery.band, C) }]}>
                  <Text style={[styles.scoreNum, { color: bandColor(recovery.band, C) }]}>
                    {recovery.score}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bandLabel, { color: bandColor(recovery.band, C) }]}>
                    {recovery.label}
                  </Text>
                  <Text style={styles.message}>{recovery.message}</Text>
                </View>
              </View>

              <View style={styles.factorRow}>
                {recovery.factors.map((f) => (
                  <View key={f.key} style={styles.factorTile}>
                    <Ionicons name={f.icon} size={15} color={factorColor(f.status, C)} />
                    <Text style={styles.factorValue}>{f.value}</Text>
                    <Text style={styles.factorLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>
            </>
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerText: { color: C.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },

    connectWrap: { marginTop: 12, alignItems: 'center' },
    connectText: { color: C.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    connectBtn: {
      marginTop: 14,
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 20,
    },
    connectBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 },
    scoreCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreNum: { fontSize: 26, fontWeight: '900' },
    bandLabel: { fontSize: 17, fontWeight: '900' },
    message: { color: C.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },

    factorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 16,
      backgroundColor: C.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      paddingVertical: 10,
    },
    factorTile: { flex: 1, minWidth: '25%', alignItems: 'center', gap: 2 },
    factorValue: { color: C.textPrimary, fontSize: 14, fontWeight: '800' },
    factorLabel: { color: C.textMuted, fontSize: 10 },
  });
  s._colors = C;
  return s;
};

export default ReadinessCard;
