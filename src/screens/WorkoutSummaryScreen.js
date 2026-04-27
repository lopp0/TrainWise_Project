import React from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import {Colors, Fonts, Spacing} from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';

const WorkoutSummaryScreen = ({navigation, route}) => {
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
                {Math.round(summary.acuteLoad)}
              </Text>
              <Text style={styles.metricSub}>7-day</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Chronic Load</Text>
              <Text style={styles.metricValue}>
                {Math.round(summary.chronicLoad)}
              </Text>
              <Text style={styles.metricSub}>28-day</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>AC Ratio</Text>
              <Text style={styles.metricValue}>
                {summary.acRatio.toFixed(2)}
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
