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
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {Colors, Fonts, Spacing} from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import ComboBox from '../components/ComboBox';
import {
  getAllActivityTypes,
  createActivityLog,
  calculateDailyLoad,
  getDailyLoadByUser,
} from '../services/api';
import { useAuth } from '../api/AuthContext';
import { sendLoadWarningIfNeeded } from '../api/NotificationService';
import { getCurrentWeather } from '../api/weatherService';
import { buildSmartSuggestion } from '../utils/smartWorkout';

const ACTIVITY_FIELDS = {
  'Running':       ['duration', 'distance', 'exertion'],
  'Walking':       ['duration', 'distance', 'exertion'],
  'Cycling':       ['duration', 'distance', 'exertion'],
  'Swimming':      ['duration', 'distance', 'exertion'],
  'Weightlifting': ['duration', 'exertion'],
  'Powerlifting':  ['duration', 'exertion'],
  'CrossFit':      ['duration', 'exertion'],
  'Yoga':          ['duration', 'exertion'],
  'Pilates':       ['duration', 'exertion'],
  'HIIT':          ['duration', 'exertion'],
  'Boxing':        ['duration', 'exertion'],
  'Basketball':    ['duration', 'exertion'],
  'Football':      ['duration', 'exertion'],
  'Tennis':        ['duration', 'exertion'],
};

const AddWorkoutScreen = ({navigation}) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [activityTypes, setActivityTypes] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [duration, setDuration] = useState('');
  const [exertion, setExertion] = useState(5);
  const [distance, setDistance] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [weather, setWeather] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [smartOpen, setSmartOpen] = useState(true); // collapsible smart card

  const shouldShow = (field) => {
    const typeName = selectedActivity?.typeName || '';
    const fields = ACTIVITY_FIELDS[typeName] || ['duration', 'exertion'];
    return fields.includes(field);
  };

  // Traffic-light color for a factor/rating status. Green = good conditions,
  // yellow = caution, red = avoid. Semantic, so it stays fixed across themes.
  const faceColor = (status) =>
    status === 'good' ? Colors.success : status === 'warn' ? Colors.warning : Colors.danger;

  useEffect(() => {
    loadActivityTypes();
    loadSmartSuggestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Weather + current load → a suggested workout. All best-effort: any failure
  // (no location permission, Weather API off, offline) just hides the card.
  const loadSmartSuggestion = async () => {
    let acRatio = null;
    try {
      const res = await getDailyLoadByUser(userId);
      const rows = Array.isArray(res.data) ? res.data : [];
      if (rows.length) {
        const latest = rows.reduce((best, cur) => {
          const bd = new Date(best.date ?? best.Date ?? 0).getTime();
          const cd = new Date(cur.date ?? cur.Date ?? 0).getTime();
          return cd > bd ? cur : best;
        });
        acRatio = latest.aC_Ratio ?? latest.AC_Ratio ?? latest.acRatio ?? null;
      }
    } catch {
      // no load history yet — fine
    }
    try {
      const w = await getCurrentWeather();
      setWeather(w);
      setSuggestion(buildSmartSuggestion({ weather: w, acRatio }));
    } catch {
      // weather unavailable — still offer a load-based suggestion if any
      setSuggestion(buildSmartSuggestion({ weather: null, acRatio }));
    }
  };

  const loadActivityTypes = async () => {
    try {
      const response = await getAllActivityTypes();
      setActivityTypes(response.data || []);
    } catch (error) {
      console.log('Failed to load activity types:', error.message);
      setActivityTypes([
        {activityTypeID: 1, typeName: 'Running'},
        {activityTypeID: 2, typeName: 'Walking'},
        {activityTypeID: 3, typeName: 'Cycling'},
        {activityTypeID: 4, typeName: 'CrossFit'},
        {activityTypeID: 5, typeName: 'Swimming'},
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedActivity) {
      Alert.alert('Missing Info', 'Please select an activity type');
      return;
    }
    if (!duration || isNaN(parseInt(duration, 10))) {
      Alert.alert('Missing Info', 'Please enter a valid duration in minutes');
      return;
    }
    if (parseInt(duration, 10) > 480) {
      Alert.alert(
        'Invalid Duration',
        'Session duration cannot exceed 480 minutes (8 hours).'
      );
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const start = new Date(now.getTime() - parseInt(duration, 10) * 60000);

      const sessionLoad = parseInt(duration, 10) * exertion;

      await createActivityLog({
        userID: userId,
        activityTypeID: selectedActivity.activityTypeID,
        startTime: start.toISOString(),
        endTime: now.toISOString(),
        distanceKM: shouldShow('distance') ? parseFloat(distance) || 0 : 0,
        avgHeartRate: 0,
        maxHeartRate: 0,
        caloriesBurned: 0,
        sourceDevice: 'Manual',
        exertionLevel: exertion,
        duration: parseInt(duration, 10),
        calculatedLoadForSession: Math.round(sessionLoad),
        isConfirmed: true,
      });

      // Trigger load recalculation
      const calcResponse = await calculateDailyLoad(userId);
      const result = calcResponse.data || {};

      await sendLoadWarningIfNeeded(
        result.ac_Ratio ?? result.acRatio ?? 0,
        result.loadLevel ?? 'Green'
      );

      navigation.navigate('WorkoutSummary', {
        summary: {
          activityName: selectedActivity.typeName,
          duration: parseInt(duration, 10),
          exertion,
          sessionLoad: Math.round(sessionLoad),
          loadLevel: result.loadLevel || 'Green',
          acuteLoad: result.acuteLoad || 0,
          chronicLoad: result.chronicLoad || 0,
          acRatio: result.ac_Ratio || result.acRatio || 0,
          stressScore: result.stressScore || 0,
          recommendation:
            result.recommendationText ||
            'Good session! Keep up the consistent training.',
        },
      });
    } catch (error) {
      const serverMsg =
        error?.response?.data || error?.message || 'unknown error';
      console.log('Submit error:', serverMsg);
      Alert.alert('Error', `Could not save workout:\n${serverMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Add a Workout"
        subtitle="Log your training session"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Smart suggestion (multi-factor weather + load aware). Intentionally
            NOT a plain <Card> — the accent border + glow + rating pill make it
            read as a distinct, actionable callout above the form fields. */}
        {suggestion && (
          <View style={styles.smartCard}>
            {/* Tappable header collapses the card so it doesn't dominate the screen */}
            <TouchableOpacity
              style={styles.smartHeader}
              activeOpacity={0.8}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSmartOpen((o) => !o);
              }}
            >
              <View style={styles.smartHeaderLeft}>
                <Ionicons name="sparkles" size={15} color={Colors.primary} />
                <Text style={styles.smartHeaderText}>SMART SUGGESTION</Text>
              </View>
              <View style={styles.smartHeaderRight}>
                {weather?.tempC != null && (
                  <Text style={styles.smartWeather} numberOfLines={1}>
                    {Math.round(weather.tempC)}°
                    {weather.description ? ` · ${weather.description}` : ''}
                  </Text>
                )}
                <Ionicons
                  name={smartOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.primary}
                />
              </View>
            </TouchableOpacity>

            {/* Always-visible gist: emoji + headline + rating */}
            <View style={styles.smartTop}>
              <Text style={styles.smartEmoji}>{suggestion.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.smartTitle}>{suggestion.title}</Text>
              </View>
              <View
                style={[
                  styles.ratingPill,
                  { borderColor: faceColor(suggestion.rating.faceColor) },
                ]}
              >
                <Text
                  style={[
                    styles.ratingPillLabel,
                    { color: faceColor(suggestion.rating.faceColor) },
                  ]}
                >
                  {suggestion.rating.label}
                </Text>
                {suggestion.score != null && (
                  <Text style={styles.ratingPillScore}>{suggestion.score}/100</Text>
                )}
              </View>
            </View>

            {/* Collapsible detail */}
            {smartOpen && (
              <>
                <Text style={styles.smartReason}>{suggestion.reason}</Text>

                {/* Per-factor breakdown: temp, humidity, UV, wind, air, rain. */}
                {suggestion.factors.length > 0 && (
                  <View style={styles.factorRow}>
                    {suggestion.factors.map((f) => (
                      <View key={f.key} style={styles.factorTile}>
                        <View style={styles.factorIconRow}>
                          <Ionicons name={f.icon} size={15} color={faceColor(f.status)} />
                          <View style={[styles.factorDot, { backgroundColor: faceColor(f.status) }]} />
                        </View>
                        <Text style={styles.factorValue} numberOfLines={1}>{f.value}</Text>
                        <Text style={styles.factorLabel} numberOfLines={1}>{f.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.smartPick}>
                  {suggestion.indoorPreferred ? 'Suggested indoor activities' : 'Suggested activities'} · tap to log
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                >
                  {suggestion.activities.map((name) => {
                    const match = activityTypes.find(
                      (a) => (a.typeName || '').toLowerCase() === name.toLowerCase()
                    );
                    if (!match) return null;
                    const selected =
                      selectedActivity?.activityTypeID === match.activityTypeID;
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => {
                          setSelectedActivity(match);
                          setDistance('');
                        }}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        )}

        {/* Activity Type */}
        <Card>
          <Text style={styles.cardTitle}>Workout Type</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <ComboBox
              items={activityTypes}
              selectedValue={selectedActivity?.activityTypeID}
              onChange={(item) => {
                setSelectedActivity(item);
                setDistance('');
              }}
              labelKey="typeName"
              valueKey="activityTypeID"
              placeholder="Select workout type"
            />
          )}
        </Card>

        {/* Duration */}
        <Card>
          <Text style={styles.cardTitle}>Session Duration (min)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 45"
            placeholderTextColor={Colors.textMuted}
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
          />
        </Card>

        {/* Exertion */}
        <Card>
          <Text style={styles.cardTitle}>Exertion Level: {exertion}/10</Text>
          <View style={styles.severityRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.severityDot,
                  exertion >= val && styles.severityDotActive,
                ]}
                onPress={() => setExertion(val)}
              />
            ))}
          </View>
          <View style={styles.severityLabels}>
            <Text style={styles.severityLabelText}>Easy</Text>
            <Text style={styles.severityLabelText}>Max Effort</Text>
          </View>
        </Card>

        {/* Distance */}
        {shouldShow('distance') && (
          <Card>
            <Text style={styles.cardTitle}>Distance (km)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5.2"
              placeholderTextColor={Colors.textMuted}
              value={distance}
              onChangeText={setDistance}
              keyboardType="decimal-pad"
            />
          </Card>
        )}
      </ScrollView>

      <View style={styles.bottomActions}>
        <PrimaryButton
          title="Apply"
          onPress={handleApply}
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
  chipRow: {
    paddingVertical: Spacing.sm,
  },
  // Smart suggestion — distinct accent card with a rating pill + factor grid.
  smartCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    // Primary-tinted glow so the block clearly stands apart from the plain
    // form cards below it.
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  smartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  smartHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smartHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, marginLeft: 8 },
  smartHeaderText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  smartWeather: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  smartTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  smartEmoji: { fontSize: 30, marginTop: 2 },
  smartTitle: {
    color: Colors.textPrimary,
    fontSize: Fonts.subtitleSize,
    fontWeight: '900',
  },
  smartReason: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
    lineHeight: 19,
    marginTop: 10,
  },
  ratingPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: Colors.cardBackgroundLight,
    minWidth: 62,
  },
  ratingPillLabel: { fontSize: 13, fontWeight: '900' },
  ratingPillScore: { color: Colors.textMuted, fontSize: 10, marginTop: 1, fontWeight: '700' },
  factorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  factorTile: { width: '33.33%', alignItems: 'center', paddingVertical: 6 },
  factorIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factorDot: { width: 6, height: 6, borderRadius: 3 },
  factorValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 3 },
  factorLabel: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  smartPick: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
    fontWeight: '700',
    marginTop: Spacing.md,
  },
  chip: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: Fonts.bodySize,
  },
  chipTextSelected: {
    color: Colors.textPrimary,
    fontWeight: Fonts.bold,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfCol: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Fonts.captionSize,
    marginBottom: Spacing.xs,
  },
  bottomActions: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
});

export default AddWorkoutScreen;
