import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveProfileImageUrl } from '../services/api';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * Avatar — profile image (or initial/icon fallback) with an optional presence
 * dot in the bottom-right corner. Green = online, grey = offline. Reused across
 * the Connect map, the network hub, and gym/coach lists.
 */
const Avatar = ({ imagePath, name, size = 54, showDot = false, online = false }) => {
  const styles = useThemedStyles(makeStyles);
  const uri = resolveProfileImageUrl(imagePath);
  const initial = (name || '').trim().charAt(0).toUpperCase();
  const dotSize = Math.max(12, Math.round(size * 0.28));

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          {initial ? (
            <Text style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>{initial}</Text>
          ) : (
            <Ionicons name="person" size={Math.round(size * 0.5)} color={styles._muted} />
          )}
        </View>
      )}
      {showDot && (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: online ? '#4CAF50' : '#7A8A96',
            },
          ]}
        />
      )}
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    fallback: {
      backgroundColor: Colors.cardBackgroundLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initial: { color: Colors.textPrimary, fontWeight: '800' },
    dot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      borderWidth: 2,
      borderColor: Colors.background,
    },
  });
  s._muted = Colors.textMuted;
  return s;
};

export default Avatar;
