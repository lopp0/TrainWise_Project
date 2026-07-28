import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import Avatar from './Avatar';

/**
 * Persistent top header for the Home screen (B-1, mockup image 1).
 *   Left  : profile avatar (-> Profile), streak (flame), coins.
 *   Right : My Network (people + unread badge), Settings (gear).
 * A separator line divides it from the screen content below (Runna-style).
 *
 * The streak/coins/unread/avatar values are passed in from HomeScreen, which
 * owns the per-account check-in + messages state — so this stays a pure
 * presentational component and the two never drift out of sync.
 *
 * The streak chip opens PersonalRecordsScreen (A-5); coins open the Shop.
 */
const HomeHeader = ({
  navigation,
  selfId,
  profileImagePath,
  fullName,
  streak = 0,
  coins = 0,
  coinsToast = 0,
  unreadCount = 0,
  calendarBadge = 0,
  coachOnly = false,
}) => {
  const styles = useThemedStyles(makeStyles);
  const go = (route, params) => navigation?.navigate(route, params);
  const hit = { top: 8, bottom: 8, left: 8, right: 8 };

  return (
    <View>
      <View style={styles.row}>
        {/* Left cluster: avatar · streak · coins */}
        <View style={styles.left}>
          <TouchableOpacity onPress={() => go('Profile')} activeOpacity={0.8} hitSlop={hit}>
            <Avatar imagePath={profileImagePath} name={fullName} size={40} />
          </TouchableOpacity>

          {/* Streak: opens Personal Records for trainees. Coach-only users have
              no personal records, so it's a plain (non-tappable) display. */}
          {coachOnly ? (
            <View style={styles.pill}>
              <Ionicons name="flame" size={18} color="#ff7a00" />
              <Text style={styles.streakValue}>{streak}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.pill}
              onPress={() => go('PersonalRecords')}
              activeOpacity={0.8}
              hitSlop={hit}
            >
              <Ionicons name="flame" size={18} color="#ff7a00" />
              <Text style={styles.streakValue}>{streak}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.pill}
            onPress={() => go('Shop')}
            activeOpacity={0.8}
            hitSlop={hit}
          >
            <Text style={styles.coinEmoji}>💰</Text>
            <Text style={styles.coinValue}>{coins}</Text>
            {coinsToast > 0 && <Text style={styles.coinToast}>+{coinsToast}</Text>}
          </TouchableOpacity>
        </View>

        {/* Right cluster: My Network · Settings */}
        <View style={styles.right}>
          <TouchableOpacity
            onPress={() => go('MyNetwork', { selfId })}
            activeOpacity={0.8}
            hitSlop={hit}
          >
            <Ionicons name="people" size={24} color={styles._primary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Training calendar — trainee feature; hidden for coach-only users. */}
          {!coachOnly && (
            <TouchableOpacity onPress={() => go('TrainingCalendar')} activeOpacity={0.8} hitSlop={hit}>
              <Ionicons name="calendar-outline" size={24} color={styles._primary} />
              {calendarBadge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{calendarBadge > 99 ? '99+' : calendarBadge}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => go('Settings')} activeOpacity={0.8} hitSlop={hit}>
            <Ionicons name="settings-outline" size={24} color={styles._primary} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.separator} />
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 10,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    right: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    streakValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '900' },
    coinEmoji: { fontSize: 15 },
    coinValue: { color: '#FFD700', fontSize: 15, fontWeight: '900' },
    coinToast: { color: '#FFD700', fontSize: 11, fontWeight: '800', marginLeft: 4 },
    badge: {
      position: 'absolute',
      top: -6,
      right: -8,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: Colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: Colors.background,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    separator: {
      height: 1,
      backgroundColor: Colors.border,
      marginHorizontal: 16,
      marginBottom: 4,
    },
  });
  s._primary = Colors.primary;
  return s;
};

export default HomeHeader;
