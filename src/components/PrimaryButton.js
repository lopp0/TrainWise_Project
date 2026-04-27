import React from 'react';
import {TouchableOpacity, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {Colors, Fonts, Spacing} from '../theme/colors';

const PrimaryButton = ({title, onPress, loading, disabled, style}) => {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.8}>
      {loading ? (
        <ActivityIndicator color={Colors.textPrimary} />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    fontWeight: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default PrimaryButton;
