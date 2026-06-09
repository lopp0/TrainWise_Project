import React, {useState, useEffect} from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {Colors, Fonts, Spacing} from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import ComboBox from '../components/ComboBox';
import {
  getAllInjuryTypes,
  createInjuryReport,
  getActiveInjuriesByUser,
  getCoachesForTrainee,
  uploadChatImage,
  sendMessage,
} from '../services/api';
import { getGPTResponse } from '../api/openai';
import { useAuth } from '../api/AuthContext';


const InjuryReportScreen = ({navigation}) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [injuryTypes, setInjuryTypes] = useState([]);
  const [selectedInjury, setSelectedInjury] = useState(null);
  const [severity, setSeverity] = useState(5);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  // Injury scanner + AI advice (#4)
  const [photo, setPhoto] = useState(null);       // local uri of the scanned injury
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(null);  // AI treatment text
  const [coachLoading, setCoachLoading] = useState(false);

  useEffect(() => {
    loadInjuryTypes();
    loadActiveCount();
  }, []);

  // Refresh active count whenever the screen regains focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadActiveCount);
    return unsub;
  }, [navigation]);

  const loadActiveCount = async () => {
    if (!userId) return;
    try {
      const response = await getActiveInjuriesByUser(userId);
      setActiveCount((response.data || []).length);
    } catch (error) {
      console.log('Failed to load active injuries:', error.message);
      setActiveCount(0);
    }
  };

  const loadInjuryTypes = async () => {
    setLoading(true);
    try {
      const response = await getAllInjuryTypes();
      setInjuryTypes(response.data || []);
    } catch (error) {
      console.log('Failed to load injury types:', error.message);
      setInjuryTypes([
        {injuryTypeID: 1, injuryName: 'Knee Pain'},
        {injuryTypeID: 2, injuryName: 'Shin Splints'},
        {injuryTypeID: 3, injuryName: 'Lower Back Pain'},
        {injuryTypeID: 4, injuryName: 'Ankle Sprain'},
        {injuryTypeID: 5, injuryName: 'Shoulder Strain'},
      ]);
    } finally {
      setLoading(false);
    }
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
        severity: severity,
        notes: notes,
        isActiveInjury: true,
      });
      Alert.alert(
        'Report Submitted',
        'Your injury has been recorded. The app will adjust your load thresholds accordingly.',
      );
      setSelectedInjury(null);
      setSeverity(5);
      setNotes('');
      setPhoto(null);
      setAiAdvice(null);
      await loadActiveCount();
    } catch (error) {
      console.log('Submit error:', error.message);
      Alert.alert('Error', 'Could not submit injury report. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Injury scanner (#4): snap a photo of the injury. Offers camera first
  // (the "scan") and falls back to the photo library.
  const scanInjury = async () => {
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

  // ── AI treatment recommendation. Built on the same OpenAI helper as the
  // in-app chatbot. The model is text-only (gpt-4o-mini), so the scanned photo
  // is referenced in the prompt but not sent as an image — swap getGPTResponse
  // for a vision call to analyze the photo itself once that's wired up. Until
  // the OpenAI key is configured this returns the helper's "not configured"
  // string, which we surface as-is.
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

  // ── Report the scanned injury to the trainee's coach(es) via the existing
  // user↔user chat. Sends the photo (if scanned) + a text summary.
  const reportToCoach = async () => {
    if (!selectedInjury) {
      Alert.alert('Pick an injury', 'Select an injury type before reporting to your coach.');
      return;
    }
    setCoachLoading(true);
    try {
      const res = await getCoachesForTrainee(userId);
      const coaches = Array.isArray(res.data) ? res.data : [];
      if (!coaches.length) {
        Alert.alert(
          'No coach connected',
          'Connect with a coach (Connect screen → scan their QR code) to report injuries to them.'
        );
        return;
      }
      const summary =
        `🩹 Injury report: ${selectedInjury.injuryName} (severity ${severity}/10).` +
        (notes?.trim() ? `\nSymptoms: ${notes.trim()}` : '');

      // Upload the photo once, then reuse its path for each coach.
      let imagePath = null;
      if (photo) {
        try {
          const up = await uploadChatImage(photo);
          imagePath = up.path;
        } catch {
          // photo upload failed — still send the text summary
        }
      }

      for (const c of coaches) {
        const coachUserId = c.coachUserID ?? c.CoachUserID;
        if (!coachUserId) continue;
        if (imagePath) {
          await sendMessage({ senderId: userId, receiverId: coachUserId, imagePath });
        }
        await sendMessage({ senderId: userId, receiverId: coachUserId, text: summary });
      }
      Alert.alert(
        'Sent to coach',
        `Your injury was sent to ${coaches.length === 1 ? 'your coach' : `${coaches.length} coaches`}.`
      );
    } catch (e) {
      Alert.alert('Error', e?.response?.data || e.message || 'Could not report to coach.');
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Injury Report"
        subtitle="Record a new injury"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Drill-down to active injuries list */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ActiveInjuries')}
        >
          <Card>
            <View style={styles.activeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Active Injuries</Text>
                <Text style={styles.activeMeta}>
                  {activeCount === 0
                    ? 'No active injuries on file'
                    : `${activeCount} active${activeCount === 1 ? '' : ' injuries'} · tap to manage`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>

        {/* Injury Type */}
        <Card>
          <Text style={styles.cardTitle}>Injury Type</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <ComboBox
              items={injuryTypes}
              selectedValue={selectedInjury?.injuryTypeID}
              onChange={(item) => setSelectedInjury(item)}
              labelKey="injuryName"
              valueKey="injuryTypeID"
              placeholder="Select injury type"
            />
          )}
        </Card>

        {/* Severity */}
        <Card>
          <Text style={styles.cardTitle}>Severity: {severity}/10</Text>
          <View style={styles.severityRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.severityDot,
                  severity >= val && styles.severityDotActive,
                ]}
                onPress={() => setSeverity(val)}
              />
            ))}
          </View>
          <View style={styles.severityLabels}>
            <Text style={styles.severityLabelText}>Mild</Text>
            <Text style={styles.severityLabelText}>Severe</Text>
          </View>
        </Card>

        {/* Notes + injury scanner + AI advice */}
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

          {/* Scanned injury photo preview */}
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

          {/* Scan button */}
          <TouchableOpacity style={styles.scanBtn} onPress={scanInjury} activeOpacity={0.85}>
            <Ionicons name="scan" size={18} color={Colors.primary} />
            <Text style={styles.scanBtnText}>
              {photo ? 'Re-scan injury' : 'Scan injury (photo)'}
            </Text>
          </TouchableOpacity>

          {/* AI advice + report-to-coach actions */}
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
            <TouchableOpacity
              style={styles.aiBtn}
              onPress={reportToCoach}
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
          </View>

          {/* AI advice result */}
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
        <PrimaryButton
          title="Submit Report"
          onPress={handleSubmit}
          loading={submitting}
        />
      </View>
    </View>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  cardTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeMeta: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
  },
  severityDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  severityDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  severityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  severityLabelText: {
    color: Colors.textMuted,
    fontSize: Fonts.captionSize,
  },
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

  // Injury scanner + AI advice
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
  aiDisclaimer: {
    color: Colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
  },
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
});

export default InjuryReportScreen;
