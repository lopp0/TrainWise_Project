import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Fonts, Spacing} from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

const ScreenHeader = ({title, subtitle, onBack}) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          // #157 — accessibility: a screen reader announces "Back, button" and
          // gets a comfortable hit target instead of a bare "<" glyph.
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  container: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  backButton: {
    position: 'absolute',
    left: Spacing.md,
    top: Spacing.xl,
    padding: Spacing.sm,
  },
  backText: {
    color: Colors.primary,
    fontSize: 24,
    fontWeight: Fonts.bold,
  },
  title: {
    fontSize: Fonts.titleSize,
    fontWeight: Fonts.bold,
    color: Colors.primary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  subtitle: {
    fontSize: Fonts.captionSize,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});

export default ScreenHeader;
