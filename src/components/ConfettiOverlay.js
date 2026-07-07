import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View, Easing } from 'react-native';

/**
 * #173 — lightweight confetti burst for milestone celebrations. Built on the
 * core RN Animated API (no extra dependency, no reanimated worklets) so it is
 * robust under the New Architecture. Renders `count` pieces that fall + spin,
 * then calls onDone. Render it conditionally (e.g. {celebrate && <ConfettiOverlay/>}).
 */
const { width, height } = Dimensions.get('window');
const COLORS = ['#E91E63', '#FFD700', '#00e676', '#2979FF', '#FF9800', '#7FFFD4', '#FF4081'];

const Piece = ({ index }) => {
  const fall = useRef(new Animated.Value(0)).current;
  const startX = useRef(Math.random() * width).current;
  const drift = useRef((Math.random() - 0.5) * 120).current;
  const size = useRef(6 + Math.random() * 8).current;
  const color = COLORS[index % COLORS.length];
  const delay = useRef(Math.random() * 400).current;
  const rounded = index % 2 === 0;

  useEffect(() => {
    Animated.timing(fall, {
      toValue: 1,
      duration: 2200 + Math.random() * 1200,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [fall, delay]);

  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] });
  const translateX = fall.interpolate({ inputRange: [0, 1], outputRange: [startX, startX + drift] });
  const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${720 + index * 30}deg`] });
  const opacity = fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size * 1.6,
        borderRadius: rounded ? size : 2,
        backgroundColor: color,
        transform: [{ translateX }, { translateY }, { rotate }],
        opacity,
      }}
    />
  );
};

const ConfettiOverlay = ({ count = 80, duration = 3200, onDone }) => {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 9000 }]}>
      {Array.from({ length: count }).map((_, i) => (
        <Piece key={i} index={i} />
      ))}
    </View>
  );
};

export default ConfettiOverlay;
