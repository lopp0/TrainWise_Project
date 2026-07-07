import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';

const STEPS = [
  {
    emoji: '🏠',
    title: 'Home Screen',
    description:
      'This is your dashboard. Here you can see your weekly training load as a bar chart. ' +
      'Each bar represents one day. Tap any bar to see that day in detail.',
  },
  {
    emoji: '➕',
    title: 'Add a Workout',
    description:
      'Tap "Add a workout" to log a training session. ' +
      'Select your activity type, enter the duration and exertion level (1-10). ' +
      'The app calculates your training load automatically.',
  },
  {
    emoji: '⚠️',
    title: 'Warnings Dashboard',
    description:
      'Tap "See warnings" to view your AC Ratio and training load status. ' +
      'Green means you are safe, yellow means caution, red means rest is needed. ' +
      'You will also see a smart recommendation based on your data.',
  },
  {
    emoji: '🤕',
    title: 'Injury Tracking',
    description:
      'Tap "Report injury" to log an active injury. ' +
      'When you have an active injury the app adjusts your load thresholds ' +
      'and warns you earlier to protect your recovery.',
  },
  {
    emoji: '🔥',
    title: 'Daily Check-In',
    description:
      'Open the app every day to build your streak and earn coins. ' +
      'Tap the streak badge at the top of the home screen to visit the Shop ' +
      'and spend your coins on cosmetic rewards.',
  },
  {
    emoji: '❤️',
    title: 'Health Connect',
    description:
      'Go to the Health tab to sync your workouts automatically from ' +
      'Health Connect. Your smartwatch or fitness app data will be imported ' +
      'and you can confirm or edit each session.',
  },
  {
    emoji: '🎉',
    title: "You're all set!",
    description:
      'TrainWise will monitor your training load and alert you before ' +
      'you risk overtraining or injury. Train smart and stay healthy!',
  },
];

const OnboardingOverlay = ({ visible, onFinish }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  // Reset the cursor whenever the overlay is dismissed, so the next showing
  // (after a Settings -> Reset Tutorial) starts from the first card.
  useEffect(() => {
    if (!visible) setStepIndex(0);
  }, [visible]);

  // Fade each card in from opacity 0 -> 1 on step changes.
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [stepIndex, opacity]);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onFinish?.();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onFinish}
    >
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity }]}>
          <Text style={styles.emoji}>{step.emoji}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.bottomRow}>
            <TouchableOpacity onPress={onFinish} hitSlop={8}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            <View style={styles.dotsRow}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === stepIndex && styles.dotActive]}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={handleNext}
              style={styles.nextBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.nextText}>
                {isLast ? 'Get Started! 🚀' : 'Next →'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1a1f2e',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    textAlign: 'center',
  },
  title: {
    color: '#ff2d6f',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },
  description: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    width: '100%',
  },
  skipText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#ff2d6f',
  },
  nextBtn: {
    backgroundColor: '#ff2d6f',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  nextText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
});

export default OnboardingOverlay;
