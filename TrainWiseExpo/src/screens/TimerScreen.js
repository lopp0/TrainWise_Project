import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ScreenHeader from '../components/ScreenHeader';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #120 — Interval / rest timer. Configure work / rest seconds and rounds, then
 * run a foreground HIIT-style timer with haptic transitions (work↔rest↔done)
 * and a big visual countdown. No backend; uses expo-haptics (already installed).
 * Sound is intentionally omitted to avoid pulling in a native audio dependency.
 */
const PHASE = { WORK: 'work', REST: 'rest', DONE: 'done', IDLE: 'idle' };

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const TimerScreen = ({ navigation }) => {
  const styles = useThemedStyles(makeStyles);
  const Colors = styles._colors;

  const [work, setWork] = useState(30);
  const [rest, setRest] = useState(15);
  const [rounds, setRounds] = useState(5);

  const [phase, setPhase] = useState(PHASE.IDLE);
  const [remaining, setRemaining] = useState(0);
  const [round, setRound] = useState(0);
  const [running, setRunning] = useState(false);

  const tick = useRef(null);

  const buzz = (style) => {
    try {
      Haptics.notificationAsync(style);
    } catch {}
  };

  const clearTick = () => {
    if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
  };

  // Advance to the next phase when the countdown hits zero.
  const advance = useCallback(() => {
    setPhase((curPhase) => {
      if (curPhase === PHASE.WORK) {
        // After work comes rest, unless it was the final round.
        let nextRound = 0;
        setRound((r) => {
          nextRound = r;
          return r;
        });
        if (round >= rounds) {
          buzz(Haptics.NotificationFeedbackType.Success);
          setRunning(false);
          clearTick();
          setRemaining(0);
          return PHASE.DONE;
        }
        buzz(Haptics.NotificationFeedbackType.Warning);
        setRemaining(rest);
        return PHASE.REST;
      }
      if (curPhase === PHASE.REST) {
        buzz(Haptics.NotificationFeedbackType.Success);
        setRound((r) => r + 1);
        setRemaining(work);
        return PHASE.WORK;
      }
      return curPhase;
    });
  }, [round, rounds, rest, work]);

  // The countdown loop.
  useEffect(() => {
    if (!running) return undefined;
    clearTick();
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        // Hit zero — advance on the next frame so state settles cleanly.
        advance();
        return 0;
      });
    }, 1000);
    return clearTick;
  }, [running, advance]);

  useEffect(() => clearTick, []);

  const start = () => {
    setRound(1);
    setPhase(PHASE.WORK);
    setRemaining(work);
    setRunning(true);
    buzz(Haptics.NotificationFeedbackType.Success);
  };
  const pause = () => setRunning(false);
  const resume = () => setRunning(true);
  const reset = () => {
    clearTick();
    setRunning(false);
    setPhase(PHASE.IDLE);
    setRemaining(0);
    setRound(0);
  };

  const phaseColor =
    phase === PHASE.WORK ? Colors.danger : phase === PHASE.REST ? Colors.success : Colors.primary;
  const phaseLabel =
    phase === PHASE.WORK ? 'WORK' : phase === PHASE.REST ? 'REST' : phase === PHASE.DONE ? 'DONE' : 'READY';
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const Stepper = ({ label, value, set, min, max, step, suffix }) => (
    <View style={styles.cfgRow}>
      <Text style={styles.cfgLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => set((v) => clamp(v - step, min, max))}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepVal}>{value}{suffix}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => set((v) => clamp(v + step, min, max))}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const idle = phase === PHASE.IDLE;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Interval Timer" subtitle="Work / rest rounds" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.dial, { borderColor: phaseColor }]}>
          <Text style={[styles.phase, { color: phaseColor }]}>{phaseLabel}</Text>
          <Text style={styles.time}>{idle ? mmss(work) : mmss(remaining)}</Text>
          {!idle && phase !== PHASE.DONE && (
            <Text style={styles.roundText}>Round {round} / {rounds}</Text>
          )}
        </View>

        {idle ? (
          <View style={styles.cfg}>
            <Stepper label="Work" value={work} set={setWork} min={5} max={600} step={5} suffix="s" />
            <Stepper label="Rest" value={rest} set={setRest} min={0} max={600} step={5} suffix="s" />
            <Stepper label="Rounds" value={rounds} set={setRounds} min={1} max={30} step={1} suffix="" />
            <TouchableOpacity style={[styles.bigBtn, { backgroundColor: Colors.primary }]} onPress={start}>
              <Ionicons name="play" size={20} color="#fff" />
              <Text style={styles.bigBtnText}>Start</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.controls}>
            {phase !== PHASE.DONE && (
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: running ? Colors.warning : Colors.success }]}
                onPress={running ? pause : resume}
              >
                <Ionicons name={running ? 'pause' : 'play'} size={20} color="#fff" />
                <Text style={styles.bigBtnText}>{running ? 'Pause' : 'Resume'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.bigBtn, { backgroundColor: Colors.cardBackgroundLight }]} onPress={reset}>
              <Ionicons name="refresh" size={20} color={Colors.textPrimary} />
              <Text style={[styles.bigBtnText, { color: Colors.textPrimary }]}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.hint}>Keep the screen on while the timer runs (foreground only).</Text>
      </ScrollView>
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scroll: { padding: 20, alignItems: 'center' },
    dial: {
      width: 240, height: 240, borderRadius: 120, borderWidth: 6,
      alignItems: 'center', justifyContent: 'center', marginVertical: 24,
      backgroundColor: Colors.cardBackground,
    },
    phase: { fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    time: { color: Colors.textPrimary, fontSize: 56, fontWeight: '900', marginTop: 4 },
    roundText: { color: Colors.textSecondary, fontSize: 14, marginTop: 6, fontWeight: '700' },
    cfg: { width: '100%', gap: 12 },
    cfgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cfgLabel: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
    stepper: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.inputBackground,
      borderRadius: 10, borderWidth: 1, borderColor: Colors.inputBorder, paddingHorizontal: 8,
    },
    stepBtn: { paddingHorizontal: 16, paddingVertical: 6 },
    stepBtnText: { color: Colors.primary, fontSize: 24, fontWeight: '800' },
    stepVal: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', minWidth: 64, textAlign: 'center' },
    controls: { width: '100%', gap: 12 },
    bigBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 16, borderRadius: 14, marginTop: 8,
    },
    bigBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    hint: { color: Colors.textMuted, fontSize: 12, marginTop: 20, textAlign: 'center' },
  });
  s._colors = Colors;
  return s;
};

export default TimerScreen;
