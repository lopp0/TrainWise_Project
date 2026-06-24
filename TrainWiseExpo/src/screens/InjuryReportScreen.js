import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts, Spacing } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import InjuryIcon from '../components/InjuryIcon';
import ActivityIcon from '../components/ActivityIcon';
import {
  getAllInjuryTypes,
  getAllActivityTypes,
  getActivityLogsByUser,
  createInjuryReport,
  getCoachesForTrainee,
  uploadChatImage,
  sendMessage,
} from '../services/api';
import { getGPTResponse } from '../api/openai';
import { parseServerDate } from '../utils/serverDate';
import { useAuth } from '../api/AuthContext';

const InjuryReportScreen = ({ navigation, route }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);

  const [injuryTypes, setInjuryTypes] = useState([]);
  const [selectedInjury, setSelectedInjury] = useState(null);
  const [severity, setSeverity] = useState(5);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // "After which workout" picker
  const [recentLogs, setRecentLogs] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logPickerOpen, setLogPickerOpen] = useState(false);

  // Injury scanner + AI advice (#4)
  const [photo, setPhoto] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(null);

  // Send-to-coach (multi-coach selection)
  const [coaches, setCoaches] = useState([]);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachModalOpen, setCoachModalOpen] = useState(false);
  const [selectedCoachIds, setSelectedCoachIds] = useState([]);

  useEffect(() => {
    loadInjuryTypes();
    loadRecentLogs();
    loadCoaches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-select the injury passed from the Home Add-Injury slider (B-2).
  useEffect(() => {
    const preId = route?.params?.preselectInjuryTypeId;
    if (preId != null && injuryTypes.length) {
      const match = injuryTypes.find((i) => i.injuryTypeID === preId);
      if (match) setSelectedInjury(match);
    }
  }, [route?.params?.preselectInjuryTypeId, injuryTypes]);

  const loadInjuryTypes = async () => {
    setLoading(true);
    try {
      const response = await getAllInjuryTypes();
      setInjuryTypes(response.data || []);
    } catch (error) {
      console.log('Failed to load injury types:', error.message);
      setInjuryTypes([
        { injuryTypeID: 1, injuryName: 'Knee Pain' },
        { injuryTypeID: 2, injuryName: 'Shin Splints' },
        { injuryTypeID: 3, injuryName: 'Lower Back Pain' },
        { injuryTypeID: 4, injuryName: 'Ankle Sprain' },
        { injuryTypeID: 5, injuryName: 'Shoulder Strain' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentLogs = async () => {
    if (!userId) return;
    try {
      const [logsRes, typesRes] = await Promise.all([
        getActivityLogsByUser(userId),
        getAllActivityTypes(),
      ]);
      const logs = Array.isArray(logsRes.data) ? logsRes.data : [];
      const sorted = [...logs].sort(
        (a, b) =>
          parseServerDate(b.startTime ?? b.StartTime) -
          parseServerDate(a.startTime ?? a.StartTime)
      );
      setRecentLogs(sorted.slice(0, 10));
      setActivityTypes(typesRes.data || []);
    } catch (error) {
      console.log('Failed to load recent workouts:', error.message);
    }
  };

  const loadCoaches = async () => {
    if (!userId) return;
    try {
      const res = await getCoachesForTrainee(userId);
      setCoaches(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCoaches([]);
    }
  };

  const activityName = (id) =>
    activityTypes.find((a) => (a.activityTypeID ?? a.ActivityTypeID) === id)?.typeName || 'Workout';

  const logId = (log) => log?.activityID ?? log?.ActivityID ?? null;

  const logLabel = (log) => {
    const d = parseServerDate(log.startTime ?? log.StartTime);
    const dur = log.duration ?? log.Duration ?? 0;
    return `${activityName(log.activityTypeID ?? log.ActivityTypeID)} · ${d.toLocaleDateString()} · ${dur} min`;
  };

  const handleSubmit = async () => {
    if (!selectedInjury) {
      Alert.alert('Missing Info', 'Please select an injury type');
      return;
    }
    setSubmitting(true);
    try {
      await createInjuryReport({
        userID: userId,
        injuryTypeID: selectedInjury.injuryTypeID,
        date: new Date().toISOString().split('T')[0],
        severity,
        notes,
        isActiveInjury: true,
        linkedActivityLogID: selectedLog ? logId(selectedLog) : null,
      });
      Alert.alert(
        'Report Submitted',
        'Your injury has been recorded. The app will adjust your load thresholds accordingly.'
      );
      setSelectedInjury(null);
      setSeverity(5);
      setNotes('');
      setPhoto(null);
      setAiAdvice(null);
      setSelectedLog(null);
    } catch (error) {
      console.log('Submit error:', error.message);
      Alert.alert('Error', error?.response?.data || 'Could not submit injury report. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Injury scanner (#4) ──
  const scanInjury = () => {
    Alert.alert('Scan injury', 'Add a photo of the injury', [
      { text: 'Take photo', onPress: () => launchScan('camera') },
      { text: 'Choose from library', onPress: () => launchScan('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const launchScan = async (source) => {
    try {
      const opts = { mediaTypes: ['images'], allowsEditing: true, quality: 0.6 };
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Allow camera access to scan an injury.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(opts);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Allow photo access to attach an image.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(opts);
      }
      if (!result.canceled && result.assets?.length) {
        setPhoto(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Camera error', e.message || 'Could not open the camera.');
    }
  };

  // ── AI advice ──
  const getAiAdvice = async () => {
    if (!selectedInjury) {
      Alert.alert('Pick an injury', 'Select an injury type first so the advice is relevant.');
      return;
    }
    setAiLoading(true);
    setAiAdvice(null);
    try {
      const injuryName = selectedInjury.injuryName || 'an injury';
      const messages = [
        {
          role: 'system',
          content:
            'You are a sports-medicine assistant inside the TrainWise training app. ' +
            'Give brief, practical first-aid and recovery guidance for a recreational athlete. ' +
            'Use short bullet points, suggest when it is safe to train again, and ALWAYS end with a ' +
            'one-line reminder to see a medical professional for severe, worsening, or persistent injuries. ' +
            'Keep it under 180 words.',
        },
        {
          role: 'user',
          content:
            `Injury: ${injuryName}. Severity: ${severity}/10. ` +
            `Symptoms / notes: ${notes?.trim() || 'none provided'}.` +
            (photo ? ' The user also scanned a photo of the injury.' : '') +
            ' How should I treat it and when can I train again?',
        },
      ];
      const reply = await getGPTResponse(messages);
      setAiAdvice(reply || 'No response. Please try again.');
    } catch {
      setAiAdvice('Could not reach the AI assistant. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // ── Send to coach (multi-coach aware) ──
  const onSendToCoach = () => {
    if (!selectedInjury) {
      Alert.alert('Pick an injury', 'Select an injury type before reporting to your coach.');
      return;
    }
    if (coaches.length === 0) {
      Alert.alert('No coach connected', 'Connect with a coach to report injuries to them.');
      return;
    }
    if (coaches.length === 1) {
      sendInjuryToCoaches(coaches);
      return;
    }
    // Multiple coaches → let the user choose.
    setSelectedCoachIds(coaches.map((c) => c.coachUserID ?? c.CoachUserID));
    setCoachModalOpen(true);
  };

  const sendInjuryToCoaches = async (list) => {
    setCoachModalOpen(false);
    setCoachLoading(true);
    try {
      const summary =
        `🩹 Injury report: ${selectedInjury.injuryName} (severity ${severity}/10).` +
        (notes?.trim() ? `\nSymptoms: ${notes.trim()}` : '') +
        (selectedLog ? `\nAfter: ${logLabel(selectedLog)}` : '');

      let imagePath = null;
      if (photo) {
        try {
          const up = await uploadChatImage(photo);
          imagePath = up.path;
        } catch {
          // photo upload failed — still send the text summary
        }
      }

      for (const c of list) {
        const coachUserId = c.coachUserID ?? c.CoachUserID;
        if (!coachUserId) continue;
        if (imagePath) {
          await sendMessage({ senderId: userId, receiverId: coachUserId, imagePath });
        }
        await sendMessage({ senderId: userId, receiverId: coachUserId, text: summary });
      }
      Alert.alert(
        'Sent to coach',
        `Your injury was sent to ${list.length === 1 ? 'your coach' : `${list.length} coaches`}.`
      );
    } catch (e) {
      Alert.alert('Error', e?.response?.data || e.message || 'Could not report to coach.');
    } finally {
      setCoachLoading(false);
    }
  };

  const toggleCoach = (id) => {
    setSelectedCoachIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Injury Report" subtitle="Record a new injury" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Injury Type — horizontal icon cards */}
          <Card>
            <Text style={styles.cardTitle}>Injury Type</Text>
            {loading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
                {injuryTypes.map((t) => {
                  const selected = selectedInjury?.injuryTypeID === t.injuryTypeID;
                  return (
                    <TouchableOpacity
                      key={t.injuryTypeID}
                      style={[styles.typeCard, selected && styles.typeCardSelected]}
                      onPress={() => setSelectedInjury(t)}
                      activeOpacity={0.85}
                    >
                      <InjuryIcon injuryTypeId={t.injuryTypeID} size={24} />
                      <Text
                        style={[styles.typeCardLabel, selected && styles.typeCardLabelSelected]}
                        numberOfLines={2}
                      >
                        {t.injuryName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Card>

          {/* After which workout (optional) */}
          <Card>
            <Text style={styles.cardTitle}>After which workout? (optional)</Text>
            <TouchableOpacity
              style={styles.pickerField}
              onPress={() => setLogPickerOpen(true)}
              activeOpacity={0.85}
            >
              {selectedLog ? (
                <>
                  <ActivityIcon
                    activityTypeId={selectedLog.activityTypeID ?? selectedLog.ActivityTypeID}
                    size={20}
                  />
                  <Text style={styles.pickerText} numberOfLines={1}>
                    {logLabel(selectedLog)}
                  </Text>
                </>
              ) : (
                <Text style={styles.pickerPlaceholder}>None · tap to choose a recent workout</Text>
              )}
              <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </Card>

          {/* Severity slider */}
          <Card>
            <Text style={styles.cardTitle}>Severity: {severity} / 10</Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={severity}
              onValueChange={setSeverity}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={Colors.primary}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>Mild</Text>
              <Text style={styles.sliderLabelText}>Severe</Text>
            </View>
          </Card>

          {/* Notes + scanner + AI + coach */}
          <Card>
            <Text style={styles.cardTitle}>Describe Symptoms / Notes</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe symptoms or medical advice..."
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            {photo && (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhoto(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.scanBtn} onPress={scanInjury} activeOpacity={0.85}>
              <Ionicons name="scan" size={18} color={Colors.primary} />
              <Text style={styles.scanBtnText}>{photo ? 'Re-scan injury' : 'Scan injury (photo)'}</Text>
            </TouchableOpacity>

            <View style={styles.aiRow}>
              <TouchableOpacity
                style={[styles.aiBtn, styles.aiBtnPrimary]}
                onPress={getAiAdvice}
                disabled={aiLoading}
                activeOpacity={0.85}
              >
                {aiLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                    <Text style={styles.aiBtnTextPrimary}>AI advice</Text>
                  </>
                )}
              </TouchableOpacity>
              {coaches.length > 0 && (
                <TouchableOpacity
                  style={styles.aiBtn}
                  onPress={onSendToCoach}
                  disabled={coachLoading}
                  activeOpacity={0.85}
                >
                  {coachLoading ? (
                    <ActivityIndicator color={Colors.primary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={15} color={Colors.primary} />
                      <Text style={styles.aiBtnText}>Send to coach</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {aiAdvice && (
              <View style={styles.aiAdviceBox}>
                <View style={styles.aiAdviceHeader}>
                  <Ionicons name="medkit" size={15} color={Colors.primary} />
                  <Text style={styles.aiAdviceTitle}>AI treatment guidance</Text>
                </View>
                <Text style={styles.aiAdviceText}>{aiAdvice}</Text>
                <Text style={styles.aiDisclaimer}>
                  AI guidance, not a medical diagnosis. See a professional for serious injuries.
                </Text>
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomActions}>
        <PrimaryButton title="Submit Report" onPress={handleSubmit} loading={submitting} />
      </View>

      {/* Recent-workout picker modal */}
      <Modal
        visible={logPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLogPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLogPickerOpen(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>After which workout?</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <TouchableOpacity
                style={styles.logRow}
                onPress={() => {
                  setSelectedLog(null);
                  setLogPickerOpen(false);
                }}
              >
                <Ionicons name="close-circle-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.logRowText}>None</Text>
              </TouchableOpacity>
              {recentLogs.length === 0 ? (
                <Text style={styles.logEmpty}>No recent workouts.</Text>
              ) : (
                recentLogs.map((log) => (
                  <TouchableOpacity
                    key={logId(log)}
                    style={styles.logRow}
                    onPress={() => {
                      setSelectedLog(log);
                      setLogPickerOpen(false);
                    }}
                  >
                    <ActivityIcon
                      activityTypeId={log.activityTypeID ?? log.ActivityTypeID}
                      size={20}
                    />
                    <Text style={styles.logRowText} numberOfLines={1}>
                      {logLabel(log)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Multi-coach selection modal */}
      <Modal
        visible={coachModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCoachModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Send to which coach?</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {coaches.map((c) => {
                const id = c.coachUserID ?? c.CoachUserID;
                const checked = selectedCoachIds.includes(id);
                return (
                  <TouchableOpacity key={id} style={styles.logRow} onPress={() => toggleCoach(id)}>
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={checked ? Colors.primary : Colors.textMuted}
                    />
                    <Text style={styles.logRowText} numberOfLines={1}>
                      {c.fullName ?? c.FullName ?? `Coach #${id}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCoachModalOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, selectedCoachIds.length === 0 && { opacity: 0.5 }]}
                disabled={selectedCoachIds.length === 0}
                onPress={() =>
                  sendInjuryToCoaches(
                    coaches.filter((c) => selectedCoachIds.includes(c.coachUserID ?? c.CoachUserID))
                  )
                }
              >
                <Text style={styles.modalSaveText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing.xxl },
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },

  // Injury type cards
  typeRow: { paddingVertical: Spacing.xs, gap: 10 },
  typeCard: {
    width: 78,
    height: 86,
    borderRadius: 14,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 6,
  },
  typeCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.cardBackgroundLight },
  typeCardLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  typeCardLabelSelected: { color: Colors.textPrimary },

  // After-which-workout picker
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  pickerText: { flex: 1, color: Colors.textPrimary, fontSize: Fonts.bodySize },
  pickerPlaceholder: { flex: 1, color: Colors.textMuted, fontSize: Fonts.bodySize },

  // Severity slider
  slider: { width: '100%', height: 40 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabelText: { color: Colors.textMuted, fontSize: Fonts.captionSize },

  textArea: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    minHeight: 100,
    fontSize: Fonts.bodySize,
  },

  // Scanner + AI
  photoWrap: {
    marginTop: Spacing.md,
    width: 110,
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  photo: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: Colors.cardBackgroundLight,
  },
  scanBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '800' },
  aiRow: { flexDirection: 'row', gap: 10, marginTop: Spacing.sm },
  aiBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.cardBackgroundLight,
  },
  aiBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  aiBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  aiBtnTextPrimary: { color: '#fff', fontSize: 13, fontWeight: '800' },
  aiAdviceBox: {
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiAdviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  aiAdviceTitle: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  aiAdviceText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  aiDisclaimer: { color: Colors.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 8 },

  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalSheet: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Fonts.subtitleSize,
    fontWeight: '900',
    marginBottom: Spacing.md,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logRowText: { flex: 1, color: Colors.textPrimary, fontSize: Fonts.bodySize },
  logEmpty: { color: Colors.textMuted, fontSize: Fonts.bodySize, paddingVertical: 12 },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalCancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '800' },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default InjuryReportScreen;
