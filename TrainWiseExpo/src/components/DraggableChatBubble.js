import React, { useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Image,
  View,
  Text,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';

const SIZE = 60;
const { width, height } = Dimensions.get('window');
// Keep the bubble above the bottom tab bar (Home / Health / Profile).
const BOTTOM_LIMIT = 110;
const TOP_LIMIT = 44;

// Drag-to-dismiss target near the bottom-center. While dragging, a "close"
// pill appears there; releasing the bubble over it removes the bubble.
const CLOSE_CX = width / 2;
const CLOSE_CY = height - 110; // matches the pill's vertical center
const CLOSE_HIT = 84; // finger within this radius of the target => over close

/**
 * A floating, draggable chat bubble. Drag it anywhere; a tap (no drag) opens
 * the chat. To remove it, drag it onto the "close" pill that appears at the
 * bottom of the screen while dragging. Absolutely positioned & SIZE×SIZE, so
 * it only intercepts touches on itself.
 *
 * Props:
 *  - onPress   : tap handler (open the conversation)
 *  - onDismiss : optional; enables drag-to-close
 *  - imageUri  : optional avatar shown inside the bubble
 *  - badge     : optional unread count shown top-right
 *  - initialX / initialY : optional start position (defaults to bottom-right)
 */
const DraggableChatBubble = ({ onPress, onDismiss, imageUri, badge = 0, initialX, initialY }) => {
  const styles = useThemedStyles(makeStyles);
  const startX = initialX ?? width - SIZE - 18;
  const startY = initialY ?? height - SIZE - BOTTOM_LIMIT - 40;
  const pan = useRef(new Animated.ValueXY({ x: startX, y: startY })).current;
  const moved = useRef(false);
  const overCloseRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [overClose, setOverClose] = useState(false);

  const setOver = (v) => {
    if (overCloseRef.current !== v) {
      overCloseRef.current = v;
      setOverClose(v);
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        moved.current = false;
        overCloseRef.current = false;
        pan.extractOffset();
      },
      onPanResponderMove: (e, g) => {
        if ((Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) && !moved.current) {
          moved.current = true;
          if (onDismiss) setDragging(true);
        }
        if (onDismiss && moved.current) {
          const over =
            Math.hypot(g.moveX - CLOSE_CX, g.moveY - CLOSE_CY) < CLOSE_HIT;
          setOver(over);
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(e, g);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const wasOverClose = overCloseRef.current;
        setDragging(false);
        setOver(false);
        if (wasOverClose && onDismiss) {
          onDismiss();
          return;
        }
        // Clamp on-screen and above the tab bar.
        const x = Math.min(Math.max(8, pan.x.__getValue()), width - SIZE - 8);
        const y = Math.min(
          Math.max(TOP_LIMIT, pan.y.__getValue()),
          height - SIZE - BOTTOM_LIMIT
        );
        pan.setValue({ x, y });
        if (!moved.current) onPress?.();
      },
    })
  ).current;

  return (
    <>
      {/* Drag-to-close target (only while dragging) */}
      {dragging && onDismiss && (
        <View pointerEvents="none" style={styles.closeWrap}>
          <View style={[styles.closePill, overClose && styles.closePillActive]}>
            <Ionicons name="close" size={20} color="#fff" />
            <Text style={styles.closeText}>
              {overClose ? 'Release to close' : 'Drag here to close'}
            </Text>
          </View>
        </View>
      )}

      <Animated.View
        style={[styles.bubble, { transform: pan.getTranslateTransform() }]}
        {...responder.panHandlers}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.img} />
        ) : (
          <Ionicons name="chatbubbles" size={28} color="#fff" />
        )}

        {/* Unread count (top-right) */}
        {badge > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}

        {/* "this is a chat" hint (bottom-right) */}
        <View style={styles.iconBadge}>
          <Ionicons name="chatbubble-ellipses" size={11} color="#fff" />
        </View>
      </Animated.View>
    </>
  );
};

const makeStyles = (C) =>
  StyleSheet.create({
    bubble: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 8,
      zIndex: 999,
    },
    img: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
    iconBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: C.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.background,
    },
    countBadge: {
      position: 'absolute',
      right: -4,
      top: -4,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 5,
      backgroundColor: C.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.background,
    },
    countText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    // Drag-to-close pill. Positioned by `top` (screen-absolute, since the host
    // view starts at y=0) so the visual target lines up with the gesture
    // hit-zone centered on CLOSE_CY.
    closeWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: CLOSE_CY - 24,
      alignItems: 'center',
      zIndex: 998,
    },
    closePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 26,
      backgroundColor: 'rgba(20,20,20,0.92)',
    },
    closePillActive: {
      backgroundColor: C.danger,
      transform: [{ scale: 1.08 }],
    },
    closeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  });

export default DraggableChatBubble;
