import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useAuth } from '../api/AuthContext';
import { getRecords } from '../services/api';
import {
  ACHIEVEMENT_TRACKS,
  buildTrack,
  getSeenAchievements,
  markAchievementsSeen,
} from '../utils/achievements';

/**
 * #147 — Tiered achievements with a celebratory unlock animation. Reads the
 * earned badge set (GET /records/{id}), groups it into Bronze→Gold tracks, and
 * pops a ZoomIn animation on any tier that was unlocked since the last visit.
 */
const AchievementsScreen = ({ navigation }) => {
  const styles = useThemedStyles(makeStyles);
  const Colors = styles._colors;
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [earned, setEarned] = useState(new Set());
  const [freshKeys, setFreshKeys] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRecords(userId);
      const badges = res.data?.badges || res.data?.Badges || [];
      const set = new Set(badges.map((b) => b.badgeKey ?? b.BadgeKey));
      const seen = await getSeenAchievements();
      // Freshly unlocked = earned now but not previously seen.
      const fresh = new Set([...set].filter((k) => !seen.has(k)));
      setEarned(set);
      setFreshKeys(fresh);
      // Remember everything earned so the celebration shows only once.
      markAchievementsSeen(set);
    } catch {
      setEarned(new Set());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const tracks = ACHIEVEMENT_TRACKS.map((t) => buildTrack(t, earned));
  const totalEarned = tracks.reduce((s, t) => s + t.earnedCount, 0);
  const totalTiers = tracks.reduce((s, t) => s + t.tiers.length, 0);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Achievements" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Achievements"
        subtitle={`${totalEarned}/${totalTiers} tiers unlocked`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {tracks.map((track, ti) => (
          <Animated.View
            key={track.key}
            entering={FadeInDown.delay(ti * 60)}
            style={styles.trackCard}
          >
            <View style={styles.trackHeader}>
              <Ionicons name={track.icon} size={18} color={Colors.primary} />
              <Text style={styles.trackLabel}>{track.label}</Text>
              {track.current && (
                <Text style={[styles.currentTier, { color: track.current.color }]}>
                  {track.current.tier}
                </Text>
              )}
            </View>

            <View style={styles.tierRow}>
              {track.tiers.map((tier) => {
                const fresh = freshKeys.has(tier.badgeKey);
                const medal = (
                  <View
                    style={[
                      styles.medal,
                      { borderColor: tier.earned ? tier.color : Colors.border },
                      tier.earned && { backgroundColor: tier.color + '22' },
                    ]}
                  >
                    <Ionicons
                      name={tier.earned ? 'medal' : 'lock-closed'}
                      size={22}
                      color={tier.earned ? tier.color : Colors.textMuted}
                    />
                    <Text
                      style={[styles.medalTier, { color: tier.earned ? tier.color : Colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {tier.tier}
                    </Text>
                    <Text style={styles.medalHint} numberOfLines={2}>
                      {tier.hint}
                    </Text>
                  </View>
                );
                return tier.earned && fresh ? (
                  <Animated.View key={tier.badgeKey} entering={ZoomIn.springify()} style={styles.medalWrap}>
                    {medal}
                    <View style={styles.newPill}>
                      <Text style={styles.newPillText}>NEW</Text>
                    </View>
                  </Animated.View>
                ) : (
                  <View key={tier.badgeKey} style={styles.medalWrap}>
                    {medal}
                  </View>
                );
              })}
            </View>

            {track.next && (
              <Text style={styles.nextHint}>
                Next: {track.next.tier} · {track.next.hint}
              </Text>
            )}
          </Animated.View>
        ))}
        <Text style={styles.footer}>Keep training to unlock the next tier.</Text>
      </ScrollView>
    </View>
  );
};

const makeStyles = (Colors) => {
  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scroll: { padding: 16, paddingBottom: 40 },
    trackCard: {
      backgroundColor: Colors.cardBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: 14,
      marginBottom: 14,
    },
    trackHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    trackLabel: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', flex: 1 },
    currentTier: { fontSize: 13, fontWeight: '900' },
    tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    medalWrap: { width: '23.5%', position: 'relative' },
    medal: {
      borderWidth: 2,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 4,
      alignItems: 'center',
      minHeight: 90,
      backgroundColor: Colors.background,
    },
    medalTier: { fontSize: 11, fontWeight: '900', marginTop: 4 },
    medalHint: { color: Colors.textMuted, fontSize: 8, textAlign: 'center', marginTop: 2 },
    newPill: {
      position: 'absolute',
      top: -6,
      right: -4,
      backgroundColor: Colors.danger,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    newPillText: { color: '#fff', fontSize: 9, fontWeight: '900' },
    nextHint: { color: Colors.textSecondary, fontSize: 12, marginTop: 12, fontStyle: 'italic' },
    footer: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  });
  s._colors = Colors;
  return s;
};

export default AchievementsScreen;
