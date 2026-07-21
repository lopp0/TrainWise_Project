import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

/**
 * A password field with a show/hide (eye) toggle. Drop-in replacement for a
 * <TextInput> — pass the SAME `style` you used before (border/background live
 * there); the eye is overlaid on the right and the input gets extra right
 * padding so text never runs under it.
 *
 * props: { value, onChangeText, placeholder, placeholderTextColor, style,
 *          wrapperStyle, iconColor, ...rest }
 */
const PasswordInput = ({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  style,
  wrapperStyle,
  iconColor,
  ...rest
}) => {
  const [show, setShow] = useState(false);
  return (
    <View style={[styles.wrap, wrapperStyle]}>
      <TextInput
        style={[style, styles.input]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor ?? Colors.textMuted}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      <TouchableOpacity
        style={styles.eye}
        onPress={() => setShow((s) => !s)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={show ? 'Hide password' : 'Show password'}
      >
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={iconColor ?? Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%', justifyContent: 'center' },
  // Ensure room for the eye button on the right.
  input: { paddingRight: 46 },
  eye: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PasswordInput;
