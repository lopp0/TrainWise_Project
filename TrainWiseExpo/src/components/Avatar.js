import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveProfileImageUrl } from '../services/api';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * Avatar — profile image (or initial/icon fallback) with optional decorations:
 *  - presence dot (bottom-right): green = online, grey = offline.
 *  - equipped FRAME (A-1): a colored ring around the avatar (`frameColor`).
 *  - equipped BADGE (A-1): a small emoji chip in the top-right (`badgeEmoji`).
 * Reused across the Connect map, the network hub, gym/coach lists, and the
 * reusable UserProfileCard.
 */
const Avatar = ({
  imagePath,
  name,
  size = 54,
  showDot = false,
  online = false,
  frameColor = null,
  badgeEmoji = null,
}) => {
  const styles = useThemedStyles(makeStyles);
  const uri = resolveProfileImageUrl(imagePath);
  const initial = (name || '').trim().charAt(0).toUpperCase();
  const dotSize = Math.max(12, Math.round(size * 0.28));
  const badgeSize = Math.max(16, Math.round(size * 0.42));
  const frameStyle = frameColor
    ? { borderWidth: Math.max(2, Math.round(size * 0.07)), borderColor: frameColor }
    : null;

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[{ width: size, height: size, borderRadius: size / 2 }, frameStyle]}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2 },
            frameStyle,
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

      {badgeEmoji ? (
        <View style={[styles.badge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
          <Text style={{ fontSize: Math.round(badgeSize * 0.6) }}>{badgeEmoji}</Text>
        </View>
      ) : null}
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
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.cardBackground,
      borderWidth: 1.5,
      borderColor: Colors.background,
    },
  });
  s._muted = Colors.textMuted;
  return s;
};

export default Avatar;
