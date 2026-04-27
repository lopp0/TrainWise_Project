import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Colors, Fonts, Spacing} from '../theme/colors';

const ScreenHeader = ({title, subtitle, onBack}) => {
  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
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
