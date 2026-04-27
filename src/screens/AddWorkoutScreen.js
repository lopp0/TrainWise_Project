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
} from 'react-native';
import {Colors, Fonts, Spacing} from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import ComboBox from '../components/ComboBox';
import {
  getAllActivityTypes,
  createActivityLog,
  calculateDailyLoad,
} from '../services/api';
import { useAuth } from '../api/AuthContext';


const AddWorkoutScreen = ({navigation}) => {
  const { userId } = useAuth();
  const [activityTypes, setActivityTypes] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [duration, setDuration] = useState('');
  const [exertion, setExertion] = useState(5);
  const [distance, setDistance] = useState('');
  const [avgHeartRate, setAvgHeartRate] = useState('');
  const [maxHeartRate, setMaxHeartRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadActivityTypes();
  }, []);

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
        distanceKM: parseFloat(distance) || 0,
        avgHeartRate: parseInt(avgHeartRate, 10) || 0,
        maxHeartRate: parseInt(maxHeartRate, 10) || 0,
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
      console.log('Submit error:', error.message);
      Alert.alert(
        'Error',
        'Could not save workout. Check your connection and try again.',
      );
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
        {/* Activity Type */}
        <Card>
          <Text style={styles.cardTitle}>Workout Type</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <ComboBox
              items={activityTypes}
              selectedValue={selectedActivity?.activityTypeID}
              onChange={(item) => setSelectedActivity(item)}
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

        {/* Heart Rate */}
        <Card>
          <Text style={styles.cardTitle}>Pulse (bpm)</Text>
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Average</Text>
              <TextInput
                style={styles.input}
                placeholder="avg"
                placeholderTextColor={Colors.textMuted}
                value={avgHeartRate}
                onChangeText={setAvgHeartRate}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Max</Text>
              <TextInput
                style={styles.input}
                placeholder="max"
                placeholderTextColor={Colors.textMuted}
                value={maxHeartRate}
                onChangeText={setMaxHeartRate}
                keyboardType="numeric"
              />
            </View>
          </View>
        </Card>
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

const styles = StyleSheet.create({
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
