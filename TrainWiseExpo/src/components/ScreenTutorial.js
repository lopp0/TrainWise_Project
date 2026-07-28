import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Colors } from '../theme/colors';

/**
 * Reusable, per-screen multi-step tooltip walkthrough (bottom-sheet style).
 * Shown the FIRST time a user visits a screen; tracking of "seen" lives in
 * utils/tutorialManager (one AsyncStorage key per screen). This REPLACES the
 * old app-wide OnboardingOverlay — each ScreenTutorial is fully independent.
 *
 * Props:
 *   visible      – boolean, whether the sheet is shown
 *   steps        – [{ title, body, icon }]  (icon is an emoji)
 *   onFinish     – called when the user finishes or skips (persist + hide)
 *   accentColor  – optional, defaults to Colors.primary
 */
const ScreenTutorial = ({ visible, steps = [], onFinish, accentColor }) => {
  const accent = accentColor || Colors.primary;
  // The theme exposes `overlay` on both palettes; fall back to a universal
  // middle-ground scrim that reads on light and dark themes alike.
  const overlay = Colors.overlay || 'rgba(0,0,0,0.5)';

  const [stepIndex, setStepIndex] = useState(0);
  const translateY = useRef(new Animated.Value(300)).current;

  // Reset to the first card whenever the sheet is (re)opened, and slide the
  // card up from the bottom.
  useEffect(() => {
    if (visible) {
      setStepIndex(0);
      translateY.setValue(300);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  if (!steps.length) return null;

  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex];
  const isLast = safeIndex === steps.length - 1;

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
      <View style={[styles.backdrop, { backgroundColor: overlay }]}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: Colors.cardBackground,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Top row: large icon + step counter */}
          <View style={styles.topRow}>
            <Text style={styles.icon}>{step.icon}</Text>
            <Text style={[styles.counter, { color: Colors.textMuted }]}>
              Step {safeIndex + 1} of {steps.length}
            </Text>
          </View>

          <Text style={[styles.title, { color: accent }]}>{step.title}</Text>
          <Text style={[styles.body, { color: Colors.textPrimary }]}>
            {step.body}
          </Text>

          {/* Bottom row: Skip all · dots · Next / Got it! */}
          <View style={styles.bottomRow}>
            <TouchableOpacity onPress={onFinish} hitSlop={8}>
              <Text style={[styles.skipText, { color: Colors.textMuted }]}>
                Skip all
              </Text>
            </TouchableOpacity>

            <View style={styles.dotsRow}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: Colors.textMuted },
                    i === safeIndex && [styles.dotActive, { backgroundColor: accent }],
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={handleNext}
              style={[styles.nextBtn, { backgroundColor: accent }]}
              activeOpacity={0.85}
            >
              <Text style={styles.nextText}>{isLast ? 'Got it!' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Layout only — colors are applied inline from the live theme singleton.
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  icon: {
    fontSize: 36,
  },
  counter: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  skipText: {
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
  },
  dotActive: {
    width: 20,
  },
  nextBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  nextText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});

export default ScreenTutorial;
