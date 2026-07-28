import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * InAppBanner — a branded toast that slides down from the top of the screen and
 * auto-dismisses. Used for in-app events (e.g. a new coach recommendation) while
 * the app is open. Driven imperatively via the module-level showInAppBanner()
 * so non-React code (the events poller) can trigger it.
 *
 * showInAppBanner({ title, message?, icon?, onPress? })
 */
let externalShow = null;

export const showInAppBanner = (cfg) => {
  if (externalShow) externalShow(cfg);
};

const AUTO_HIDE_MS = 4500;

export const InAppBannerProvider = ({ children }) => {
  const styles = useThemedStyles(makeStyles);
  const [banner, setBanner] = useState(null);
  const translateY = useRef(new Animated.Value(-220)).current;
  const hideTimer = useRef(null);

  useEffect(() => {
    externalShow = (cfg) => setBanner(cfg);
    return () => {
      externalShow = null;
    };
  }, []);

  const dismiss = () => {
    clearTimeout(hideTimer.current);
    Animated.timing(translateY, {
      toValue: -220,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setBanner(null));
  };

  useEffect(() => {
    if (!banner) return undefined;
    translateY.setValue(-220);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 8,
      speed: 14,
    }).start();
    hideTimer.current = setTimeout(dismiss, AUTO_HIDE_MS);
    return () => clearTimeout(hideTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner]);

  return (
    <>
      {children}
      {banner && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.wrap, { transform: [{ translateY }] }]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.banner}
            onPress={() => {
              const cb = banner.onPress;
              dismiss();
              cb && cb();
            }}
          >
            <View style={styles.iconCircle}>
              <Ionicons name={banner.icon || 'notifications'} size={22} color="#fff" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title} numberOfLines={1}>
                {banner.title}
              </Text>
              {!!banner.message && (
                <Text style={styles.message} numberOfLines={2}>
                  {banner.message}
                </Text>
              )}
            </View>
            {!!banner.onPress && (
              <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.95)" />
            )}
            <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
};

const makeStyles = (C) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: 46, // clear the status bar
      paddingHorizontal: 12,
      zIndex: 10000,
      elevation: 10000,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.primary,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 14,
    },
    iconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textWrap: { flex: 1 },
    title: { color: '#fff', fontSize: 16, fontWeight: '900' },
    message: { color: 'rgba(255,255,255,0.95)', fontSize: 13, marginTop: 2 },
  });

export default InAppBannerProvider;
