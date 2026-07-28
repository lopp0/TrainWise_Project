import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import { getQuestsState, claimQuest } from '../utils/quests';

/**
 * #148 — Daily / weekly quests (Home dashboard widget). Lists quests generated
 * from the user's stats with a progress bar and a claim button that awards coins.
 * Self-contained: reads quest state from `logs`; calls onClaimed(balance) so the
 * parent can refresh the coin display.
 *
 * props: { logs, onClaimed }
 */
const QuestsCard = ({ logs, onClaimed }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const [quests, setQuests] = useState([]);
  const [open, setOpen] = useState(false); // #6 foldable (closed by default)

  const refresh = useCallback(async () => {
    const q = await getQuestsState(logs);
    setQuests(q);
  }, [logs]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onClaim = async (quest) => {
    const res = await claimQuest(quest);
    if (res.ok) {
      await refresh();
      onClaimed?.(res.balance);
    }
  };

  if (!quests.length) return null;
  const dailies = quests.filter((q) => q.period === 'daily');
  const weeklies = quests.filter((q) => q.period === 'weekly');

  const renderQuest = (q) => {
    const frac = q.target > 0 ? Math.min(1, q.progress / q.target) : 0;
    return (
      <View key={q.id} style={styles.quest}>
        <View style={[styles.qIcon, q.complete && { backgroundColor: '#00e67622' }]}>
          <Ionicons name={q.icon} size={18} color={q.complete ? '#00e676' : C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.qTop}>
            <Text style={styles.qTitle} numberOfLines={1}>{q.title}</Text>
            <View style={styles.reward}>
              <Text style={styles.coinEmoji}>💰</Text>
              <Text style={styles.rewardText}>{q.reward}</Text>
            </View>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${frac * 100}%`, backgroundColor: q.complete ? '#00e676' : C.primary }]} />
          </View>
          <Text style={styles.qProgress}>{Math.min(q.progress, q.target)} / {q.target}</Text>
        </View>
        {q.claimed ? (
          <View style={styles.claimedTag}>
            <Ionicons name="checkmark" size={16} color="#00e676" />
          </View>
        ) : q.claimable ? (
          <TouchableOpacity style={styles.claimBtn} onPress={() => onClaim(q)} activeOpacity={0.85}>
            <Text style={styles.claimText}>Claim</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.claimPlaceholder} />
        )}
      </View>
    );
  };

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.headerRow} activeOpacity={0.7} onPress={toggle}>
        <View style={styles.headerLeft}>
          <Ionicons name="ribbon-outline" size={15} color={C.primary} />
          <Text style={styles.headerText}>QUESTS</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.primary} />
      </TouchableOpacity>

      {open && (
        <>
          {dailies.length > 0 && <Text style={styles.section}>Today</Text>}
          {dailies.map(renderQuest)}
          {weeklies.length > 0 && <Text style={styles.section}>This week</Text>}
          {weeklies.map(renderQuest)}
        </>
      )}
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    card: { backgroundColor: C.cardBackground, borderRadius: 16, padding: 16, marginTop: 14, borderWidth: 1, borderColor: C.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerText: { color: C.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    coinEmoji: { fontSize: 12 },
    section: { color: C.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
    quest: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    qIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cardBackgroundLight },
    qTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    qTitle: { color: C.textPrimary, fontSize: 13, fontWeight: '700', flex: 1, paddingRight: 8 },
    reward: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    rewardText: { color: '#FFD700', fontSize: 12, fontWeight: '800' },
    barTrack: { height: 5, borderRadius: 3, backgroundColor: C.cardBackgroundLight, marginTop: 5, overflow: 'hidden' },
    barFill: { height: 5, borderRadius: 3 },
    qProgress: { color: C.textMuted, fontSize: 10, marginTop: 3 },
    claimBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, backgroundColor: C.primary },
    claimText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    claimedTag: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00e67622' },
    claimPlaceholder: { width: 30 },
  });
  s._colors = C;
  return s;
};

export default QuestsCard;
