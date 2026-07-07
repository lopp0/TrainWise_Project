import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image,
  ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {Colors, Fonts, Spacing} from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../api/AuthContext';
import {
  getWorkoutNotes, setWorkoutNotes, uploadChatImage,
  getKudos, toggleKudos, resolveProfileImageUrl,
} from '../services/api';

const WorkoutSummaryScreen = ({navigation, route}) => {
  const styles = useThemedStyles(makeStyles);
  const { userId } = useAuth();
  // #124/#171 need the workout's log id; callers pass it as route.params.logId
  // (falls back to summary.activityId). When absent, those cards stay hidden.
  const logId = route?.params?.logId ?? route?.params?.summary?.activityId ?? null;
  const ownerId = route?.params?.ownerId ?? null;
  const isOwnWorkout = ownerId == null || ownerId === userId;

  const [notes, setNotes] = useState('');
  const [photoPath, setPhotoPath] = useState(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [kudos, setKudos] = useState({ count: 0, kudoed: false });

  const loadExtras = useCallback(async () => {
    if (!logId) return;
    try {
      const res = await getWorkoutNotes(logId);
      setNotes(res.data?.notes ?? '');
      setPhotoPath(res.data?.photoPath ?? null);
    } catch {}
    try {
      const k = await getKudos(logId, userId);
      setKudos({ count: k.data?.count ?? 0, kudoed: !!k.data?.kudoed });
    } catch {}
  }, [logId, userId]);

  useEffect(() => { loadExtras(); }, [loadExtras]);

  const pickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (res.canceled || !res.assets?.length) return;
      const up = await uploadChatImage(res.assets[0].uri);
      setPhotoPath(up.path);
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Could not upload the photo.');
    }
  };

  const saveNotes = async () => {
    if (!logId) return;
    setSavingNotes(true);
    try {
      await setWorkoutNotes(logId, { notes, photoPath });
      Alert.alert('Saved', 'Your note has been saved.');
    } catch (e) {
      Alert.alert('Error', e.response?.data || 'Could not save the note.');
    } finally {
      setSavingNotes(false);
    }
  };

  const onToggleKudos = async () => {
    if (!logId) return;
    try {
      const res = await toggleKudos(logId, userId);
      setKudos({ count: res.data?.count ?? kudos.count, kudoed: !!res.data?.kudoed });
    } catch {}
  };

  const summary = route?.params?.summary || {
    activityName: 'Running',
    duration: 45,
    exertion: 7,
    sessionLoad: 315,
    loadLevel: 'Green',
    acuteLoad: 1200,
    chronicLoad: 1100,
    acRatio: 1.09,
    stressScore: 55,
    recommendation: 'Good balanced session. Keep your current rhythm.',
  };

  const getLevelColor = (level) => {
    if (level === 'Red') return Colors.red;
    if (level === 'Yellow') return Colors.yellow;
    return Colors.green;
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Workout Summary"
        subtitle="Your session results"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Session Info */}
        <Card>
          <Text style={styles.cardTitle}>Session Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Activity</Text>
            <Text style={styles.value}>{summary.activityName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.value}>{summary.duration} min</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Exertion</Text>
            <Text style={styles.value}>{summary.exertion}/10</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Session Load</Text>
            <Text style={styles.valuePrimary}>{summary.sessionLoad}</Text>
          </View>
        </Card>

        {/* Load Level */}
        <Card>
          <Text style={styles.cardTitle}>Load Assessment</Text>
          <View style={styles.levelContainer}>
            <View
              style={[
                styles.levelBadge,
                {backgroundColor: getLevelColor(summary.loadLevel)},
              ]}>
              <Text style={styles.levelText}>{summary.loadLevel}</Text>
            </View>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Acute Load</Text>
              <Text style={styles.metricValue}>
                {summary.acuteLoad != null ? Math.round(summary.acuteLoad) : '—'}
              </Text>
              <Text style={styles.metricSub}>7-day</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Chronic Load</Text>
              <Text style={styles.metricValue}>
                {summary.chronicLoad != null ? Math.round(summary.chronicLoad) : '—'}
              </Text>
              <Text style={styles.metricSub}>28-day</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>AC Ratio</Text>
              <Text style={styles.metricValue}>
                {summary.acRatio != null ? Number(summary.acRatio).toFixed(2) : '—'}
              </Text>
              <Text style={styles.metricSub}>acute/chronic</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Stress</Text>
              <Text style={styles.metricValue}>{summary.stressScore}</Text>
              <Text style={styles.metricSub}>0-100</Text>
            </View>
          </View>
        </Card>

        {/* Recommendation */}
        <Card>
          <Text style={styles.cardTitle}>Recommendation</Text>
          <Text style={styles.recommendationText}>{summary.recommendation}</Text>
        </Card>

        {/* #171 — kudos / cheers */}
        {logId && (
          <Card>
            <Text style={styles.cardTitle}>Kudos</Text>
            <View style={styles.kudosRow}>
              <Text style={styles.kudosCount}>
                {kudos.count} {kudos.count === 1 ? 'cheer' : 'cheers'}
              </Text>
              {!isOwnWorkout && (
                <TouchableOpacity
                  style={[styles.kudosBtn, kudos.kudoed && styles.kudosBtnActive]}
                  onPress={onToggleKudos}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={kudos.kudoed ? 'hand-right' : 'hand-right-outline'}
                    size={18}
                    color={kudos.kudoed ? '#fff' : Colors.primary}
                  />
                  <Text style={[styles.kudosBtnText, kudos.kudoed && { color: '#fff' }]}>
                    {kudos.kudoed ? 'Cheered' : 'Give kudos'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        )}

        {/* #124 — per-workout note + photo */}
        {logId && isOwnWorkout && (
          <Card>
            <Text style={styles.cardTitle}>Notes & Photo</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did it feel? Add a note…"
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            {photoPath ? (
              <Image
                source={{ uri: resolveProfileImageUrl(photoPath) }}
                style={styles.notesPhoto}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.notesActions}>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} activeOpacity={0.85}>
                <Ionicons name="image-outline" size={18} color={Colors.primary} />
                <Text style={styles.photoBtnText}>{photoPath ? 'Change photo' : 'Add photo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveNotesBtn, savingNotes && { opacity: 0.6 }]}
                onPress={saveNotes}
                disabled={savingNotes}
                activeOpacity={0.85}
              >
                {savingNotes ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveNotesText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        )}
      </ScrollView>

      <View style={styles.bottomActions}>
        <PrimaryButton
          title="Back to Dashboard"
          onPress={() => navigation.navigate('Warnings')}
        />
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('AddWorkout')}>
          <Text style={styles.secondaryButtonText}>Log Another Workout</Text>
        </TouchableOpacity>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.semiBold,
  },
  valuePrimary: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
  },
  levelContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  levelBadge: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 30,
  },
  levelText: {
    color: '#000',
    fontSize: 22,
    fontWeight: Fonts.bold,
    letterSpacing: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  metric: {
    width: '48%',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: Fonts.bold,
    marginTop: Spacing.xs,
  },
  metricSub: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  recommendationText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    lineHeight: 22,
  },
  // #171 kudos
  kudosRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kudosCount: { color: Colors.textPrimary, fontSize: Fonts.bodySize, fontWeight: Fonts.bold },
  kudosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  kudosBtnActive: { backgroundColor: Colors.primary },
  kudosBtnText: { color: Colors.primary, fontWeight: Fonts.bold, fontSize: Fonts.captionSize + 1 },
  // #124 notes + photo
  notesInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    fontSize: Fonts.bodySize,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  notesPhoto: { width: '100%', height: 180, borderRadius: 10, marginTop: Spacing.sm },
  notesActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 10, paddingVertical: Spacing.md,
  },
  photoBtnText: { color: Colors.primary, fontWeight: Fonts.semiBold, fontSize: Fonts.bodySize },
  saveNotesBtn: {
    flex: 1, backgroundColor: Colors.primary, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md,
  },
  saveNotesText: { color: '#fff', fontWeight: Fonts.bold, fontSize: Fonts.bodySize },
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
});

export default WorkoutSummaryScreen;
