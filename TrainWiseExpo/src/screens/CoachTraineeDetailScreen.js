import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getTraineeLoad,
  createCoachRecommendation,
  getActiveInjuriesByUser,
  getAllInjuryTypes,
  resolveProfileImageUrl,
  disconnectCoachTrainee,
  calculateDailyLoad,
} from '../services/api';
import { getActivityLogs } from '../api/api';
import { useAuth } from '../api/AuthContext';
import { useMessages } from '../api/MessagesContext';
import ScreenHeader from '../components/ScreenHeader';
import DraggableChatBubble from '../components/DraggableChatBubble';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { loadLevelColor, loadLevelLabel } from './CoachDashboardScreen';
import { getBarColor } from './HomeScreen';

const DAY_MS = 24 * 60 * 60 * 1000;

// Build a 7-day window from the trainee's confirmed ActivityLogs, summing each
// day's session load. weekOffset shifts the window in 7-day blocks (0 = ending
// today, -1 = the previous week, …) so the coach can page through the trainee's
// full history. Each day keeps its workouts so a tapped bar can show per-workout
// detail. Coloring uses the shared getBarColor thresholds so the coach sees the
// same green/yellow/orange/red intensity scale as the trainee.
const buildTraineeWeek = (logs, weekOffset = 0) => {
  const anchor = new Date();
  anchor.setHours(0, 0, 0, 0);
  anchor.setDate(anchor.getDate() + weekOffset * 7); // last day of this window
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor.getTime() - (6 - i) * DAY_MS);
    return { date: d, load: 0, workouts: [] };
  });
  const idxByDate = {};
  days.forEach((d, i) => { idxByDate[d.date.toDateString()] = i; });

  (logs || []).forEach((w) => {
    if ((w.isConfirmed ?? w.IsConfirmed) === false) return; // pending don't count
    const key = new Date(w.startTime || w.StartTime).toDateString();
    const idx = idxByDate[key];
    if (idx === undefined) return;
    const load = Number(
      w.calculatedLoadForSession ??
        w.CalculatedLoadForSession ??
        (w.duration || 0) * (w.exertionLevel || 5)
    );
    days[idx].load += load;
    days[idx].workouts.push(w);
  });
  days.forEach((d) => { d.load = Math.round(d.load); });
  return days;
};

const ACTIVITY_NAMES = { 1: 'Running', 2: 'Walking', 3: 'Cycling', 4: 'Weightlifting', 5: 'Other' };
const fmtTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Jerusalem',
    });
  } catch { return ''; }
};
const fmtPace = (km, min) => {
  if (!km || km <= 0 || !min || min <= 0) return null;
  const p = min / km;
  const mm = Math.floor(p);
  const ss = String(Math.round((p - mm) * 60)).padStart(2, '0');
  return `${mm}:${ss}/km`;
};

const ageFromBirthYear = (by) =>
  by && by > 0 ? new Date().getFullYear() - by : null;

const CoachTraineeDetailScreen = ({ route, navigation }) => {
  const { coachId, trainee } = route.params || {};
  const { userId: myUserId } = useAuth();
  const { unreadCount } = useMessages();
  const traineeId = trainee?.userID ?? trainee?.UserID;
  const traineeName = trainee?.fullName ?? trainee?.FullName ?? `User #${traineeId}`;
  const traineeImage = trainee?.profileImagePath ?? trainee?.ProfileImagePath ?? null;
  const styles = useThemedStyles(makeStyles);

  const openChat = () =>
    navigation.navigate('Chat', {
      selfId: myUserId,
      peerId: traineeId,
      peerName: traineeName,
      peerImagePath: traineeImage,
    });

  const [history, setHistory] = useState([]);
  const [traineeLogs, setTraineeLogs] = useState([]);
  const [injuries, setInjuries] = useState([]);
  const [injuryTypes, setInjuryTypes] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null); // tapped bar's day
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = prev…
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!coachId || !traineeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Self-heal stale DailyLoad: recompute the trainee's last 7 days with the
      // current algorithm before reading, so the coach sees an up-to-date AC
      // ratio / status (stored rows may predate the cold-start fix).
      const today = new Date();
      await Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          return calculateDailyLoad(traineeId, d).catch(() => {});
        })
      );

      // DailyLoad (status card) + the trainee's raw workouts (chart + drill-down).
      const [loadRes, logs, injRes, typesRes] = await Promise.all([
        getTraineeLoad(coachId, traineeId),
        getActivityLogs(traineeId).catch(() => []),
        getActiveInjuriesByUser(traineeId).catch(() => ({ data: [] })),
        getAllInjuryTypes().catch(() => ({ data: [] })),
      ]);
      const rows = Array.isArray(loadRes.data) ? loadRes.data : [];
      rows.sort((a, b) => new Date(a.date ?? a.Date) - new Date(b.date ?? b.Date));
      setHistory(rows);
      setTraineeLogs(Array.isArray(logs) ? logs : []);
      setInjuries(Array.isArray(injRes?.data) ? injRes.data : []);
      setInjuryTypes(Array.isArray(typesRes?.data) ? typesRes.data : []);
    } catch (e) {
      Alert.alert('Error', e.response?.data || 'Could not load trainee data.');
    } finally {
      setLoading(false);
    }
  }, [coachId, traineeId]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = history[history.length - 1];
  const latestLevel = latest?.loadLevel ?? latest?.LoadLevel;
  const latestRatio = latest?.aC_Ratio ?? latest?.AC_Ratio;
  // Per-day chart from the trainee's actual workouts (intensity-colored, tappable).
  const week = buildTraineeWeek(traineeLogs, weekOffset);
  const maxLoad = Math.max(...week.map((d) => d.load), 100);
  const weekRangeLabel = `${week[0].date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })} – ${week[6].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  // Injuries carry only injuryTypeID — resolve the readable name from the
  // injury-types catalog (same as ActiveInjuriesScreen).
  const injuryNameById = (id) =>
    injuryTypes.find((t) => t.injuryTypeID === id)?.injuryName || `Injury #${id}`;

  const handleSend = async () => {
    if (!title.trim() || !text.trim()) {
      Alert.alert('Missing fields', 'Add both a title and a message.');
      return;
    }
    setSending(true);
    try {
      await createCoachRecommendation({
        coachId,
        userId: traineeId,
        title: title.trim(),
        text: text.trim(),
      });
      Alert.alert('Sent', `Your recommendation was sent to ${traineeName}.`, [
        { text: 'OK' },
      ]);
      setTitle('');
      setText('');
    } catch (e) {
      Alert.alert('Error', e.response?.data || 'Could not send recommendation.');
    } finally {
      setSending(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Remove trainee?',
      `Stop following ${traineeName}? You'll lose access to their training load and injuries. They can reconnect by scanning your QR code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectCoachTrainee(coachId, traineeId);
              Alert.alert('Removed', `${traineeName} is no longer your trainee.`, [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              Alert.alert('Error', e.response?.data || 'Could not remove. Try again.');
            }
          },
        },
      ]
    );
  };

  const age = ageFromBirthYear(trainee?.birthYear ?? trainee?.BirthYear);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <ScreenHeader
          title={traineeName}
          subtitle={[age ? `${age} yrs` : null, trainee?.gender ?? trainee?.Gender]
            .filter(Boolean)
            .join(' • ')}
          onBack={() => navigation.goBack()}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {loading ? (
            <ActivityIndicator
              color={Colors.primary}
              size="large"
              style={{ marginTop: 50 }}
            />
          ) : (
            <>
              {/* Current status */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Current status</Text>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: loadLevelColor(latestLevel, latestRatio) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusLabel,
                      { color: loadLevelColor(latestLevel, latestRatio) },
                    ]}
                  >
                    {loadLevelLabel(latestLevel, latestRatio)}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.statusRatio}>
                    AC {latestRatio != null ? Number(latestRatio).toFixed(2) : '—'}
                  </Text>
                </View>
                {latest && (
                  <Text style={styles.statusMeta}>
                    Acute {Math.round(latest.acuteLoad ?? latest.AcuteLoad ?? 0)} ·
                    Chronic {Math.round(latest.chronicLoad ?? latest.ChronicLoad ?? 0)} ·
                    Stress {latest.stressScore ?? latest.StressScore ?? 0}
                  </Text>
                )}
              </View>

              {/* Active injuries reported by the trainee — surfaces injury
                  reports to the connected coach (#5b). */}
              {injuries.length > 0 && (
                <View style={[styles.card, { borderColor: '#e74c3c' }]}>
                  <Text style={[styles.cardTitle, { color: '#e74c3c' }]}>
                    ⚠️ Active injuries ({injuries.length})
                  </Text>
                  {injuries.map((inj, i) => {
                    const type = injuryNameById(inj.injuryTypeID ?? inj.InjuryTypeID);
                    const sev = inj.severity ?? inj.Severity;
                    const when = inj.reportedDate ?? inj.ReportedDate ?? inj.date ?? inj.Date;
                    const notes = inj.notes ?? inj.Notes;
                    return (
                      <View key={i} style={styles.injuryRow}>
                        <View style={styles.woHeader}>
                          <Text style={styles.injuryType}>{type}</Text>
                          {sev != null && (
                            <Text style={styles.injurySev}>Severity {sev}/10</Text>
                          )}
                        </View>
                        {when && (
                          <Text style={styles.injuryMeta}>
                            Reported {new Date(when).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </Text>
                        )}
                        {!!notes && <Text style={styles.injuryNotes}>{notes}</Text>}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Per-day workout-load chart (tap a bar for that day's details) */}
              <View style={styles.card}>
                <View style={styles.weekNav}>
                  <TouchableOpacity
                    style={styles.weekNavBtn}
                    onPress={() => setWeekOffset((o) => o - 1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>
                      {weekOffset === 0 ? 'This week' : weekRangeLabel}
                    </Text>
                    <Text style={styles.weekRange}>{weekRangeLabel}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.weekNavBtn, weekOffset >= 0 && styles.weekNavBtnDisabled]}
                    onPress={() => setWeekOffset((o) => Math.min(0, o + 1))}
                    disabled={weekOffset >= 0}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={weekOffset >= 0 ? Colors.textMuted : Colors.primary}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.chartHint}>Tap a day to see its workouts</Text>
                <View style={styles.chartRow}>
                  {week.map((d, i) => {
                    const h = d.load > 0 ? Math.max(6, (d.load / maxLoad) * 100) : 6;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={styles.chartCol}
                        activeOpacity={0.7}
                        onPress={() => d.workouts.length && setSelectedDay(d)}
                      >
                        <View style={styles.barWrap}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: h,
                                backgroundColor:
                                  d.load > 0 ? getBarColor(d.load) : Colors.cardBackgroundLight,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.barLabel}>
                          {d.date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Send recommendation */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Send recommendation</Text>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ease off this week"
                  placeholderTextColor={Colors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={80}
                />
                <Text style={styles.fieldLabel}>Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Your guidance for the trainee…"
                  placeholderTextColor={Colors.textMuted}
                  value={text}
                  onChangeText={setText}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, sending && { opacity: 0.6 }]}
                  onPress={handleSend}
                  disabled={sending}
                  activeOpacity={0.85}
                >
                  {sending ? (
                    <ActivityIndicator color={Colors.textPrimary} />
                  ) : (
                    <Text style={styles.sendBtnText}>Send to {traineeName}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Disconnect this trainee */}
              <TouchableOpacity
                style={styles.disconnectBtn}
                onPress={handleDisconnect}
                activeOpacity={0.85}
              >
                <Ionicons name="unlink" size={18} color="#e74c3c" />
                <Text style={styles.disconnectText}>Remove trainee</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Tapped-day workout details */}
        <Modal
          visible={!!selectedDay}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedDay(null)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedDay(null)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {selectedDay?.date.toLocaleDateString('en-US', {
                  weekday: 'long', month: 'short', day: 'numeric',
                })}
              </Text>
              <Text style={styles.modalSub}>
                {selectedDay?.workouts.length} workout
                {selectedDay?.workouts.length === 1 ? '' : 's'} · load {selectedDay?.load}
              </Text>
              <ScrollView style={{ maxHeight: 360 }}>
                {(selectedDay?.workouts || []).map((w, i) => {
                  const name = ACTIVITY_NAMES[w.activityTypeID] || 'Workout';
                  const dur = w.duration || 0;
                  const km = w.distanceKM || 0;
                  const cal = w.caloriesBurned || 0;
                  const pace = fmtPace(km, dur);
                  const isHC = w.sourceDevice === 'Health Connect';
                  return (
                    <View key={i} style={styles.woRow}>
                      <View style={styles.woHeader}>
                        <Text style={styles.woName}>{name}</Text>
                        <Text style={styles.woTime}>{fmtTime(w.startTime)}</Text>
                      </View>
                      <View style={styles.woStats}>
                        <Text style={styles.woStat}>⏱ {dur} min</Text>
                        {km > 0 && <Text style={styles.woStat}>🗺 {km.toFixed(2)} km</Text>}
                        {pace && <Text style={styles.woStat}>⚡ {pace}</Text>}
                        {cal > 0 && <Text style={styles.woStat}>🔥 {Math.round(cal)} cal</Text>}
                      </View>
                      <Text style={styles.woSource}>
                        {isHC ? '📲 Health Connect' : '✍️ Manual'}
                        {isHC && '  ·  route is on the trainee’s device only'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedDay(null)}>
                <Ionicons name="close" size={18} color={Colors.textPrimary} />
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Draggable chat bubble — drag anywhere, tap to open the conversation,
            "−" to dismiss it for this visit. */}
        {!loading && !bubbleDismissed && (
          <DraggableChatBubble
            onPress={openChat}
            onDismiss={() => setBubbleDismissed(true)}
            badge={unreadCount}
            imageUri={traineeImage ? resolveProfileImageUrl(traineeImage) : null}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (C) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    scroll: { padding: 16, paddingBottom: 40 },

    card: {
      backgroundColor: C.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    cardTitle: {
      color: C.primary,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 12,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    statusDot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
    statusLabel: { fontSize: 16, fontWeight: '800' },
    statusRatio: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
    statusMeta: { color: C.textSecondary, fontSize: 12, marginTop: 10 },

    chartRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: 130,
    },
    chartCol: { flex: 1, alignItems: 'center' },
    barWrap: { height: 100, justifyContent: 'flex-end' },
    bar: { width: 22, borderRadius: 5 },
    barLabel: { color: C.textSecondary, fontSize: 9, marginTop: 5 },
    noData: { color: C.textMuted, fontSize: 13, textAlign: 'center' },
    chartHint: { color: C.textMuted, fontSize: 11, marginTop: -6, marginBottom: 10 },
    weekNav: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    weekNavBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.cardBackgroundLight,
    },
    weekNavBtnDisabled: { opacity: 0.4 },
    weekRange: { color: C.textSecondary, fontSize: 11, marginTop: 2 },

    injuryRow: {
      backgroundColor: 'rgba(231,76,60,0.08)',
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    injuryType: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
    injurySev: { color: '#e74c3c', fontSize: 12, fontWeight: '700' },
    injuryMeta: { color: C.textSecondary, fontSize: 12, marginTop: 4 },
    injuryNotes: { color: C.textSecondary, fontSize: 13, marginTop: 6, fontStyle: 'italic' },

    // Day-detail modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    modalCard: {
      backgroundColor: C.cardBackground,
      borderRadius: 14,
      padding: 18,
      borderWidth: 1,
      borderColor: C.border,
    },
    modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '800' },
    modalSub: { color: C.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 12 },
    woRow: {
      backgroundColor: C.cardBackgroundLight,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    woHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    woName: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
    woTime: { color: C.textSecondary, fontSize: 12 },
    woStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
    woStat: { color: C.textSecondary, fontSize: 13, fontWeight: '500' },
    woSource: { color: C.textMuted, fontSize: 10, marginTop: 8 },
    modalClose: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: C.primary,
      borderRadius: 10,
      paddingVertical: 12,
      marginTop: 4,
    },
    modalCloseText: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },

    fieldLabel: {
      color: C.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
      marginTop: 4,
    },
    input: {
      backgroundColor: C.inputBackground,
      borderRadius: 10,
      padding: 12,
      color: C.textPrimary,
      borderWidth: 1,
      borderColor: C.inputBorder,
      fontSize: 14,
      marginBottom: 10,
    },
    textArea: { minHeight: 96 },
    sendBtn: {
      backgroundColor: C.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    sendBtnText: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },

    disconnectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#e74c3c',
      marginTop: 2,
    },
    disconnectText: { color: '#e74c3c', fontSize: 15, fontWeight: '800' },
  });

export default CoachTraineeDetailScreen;
