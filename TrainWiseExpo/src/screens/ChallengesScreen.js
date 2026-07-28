import React, { useEffect, useCallback, useState } from 'react';
import ScreenTutorial from '../components/ScreenTutorial';
import { isTutorialDone, markTutorialDone } from '../utils/tutorialManager';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import { useSocial } from '../api/SocialContext';
import {
  getChallengesForUser,
  createChallenge,
  getChallengeStandings,
  leaveChallenge,
  getChallengeInvites,
  respondChallengeInvite,
  getFriends,
} from '../services/api';
import Avatar from '../components/Avatar';
import UserProfileCard from '../components/UserProfileCard';
import { experienceLabel } from '../utils/experience';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #142 — Friend challenges. Create a challenge, invite trainee friends (they get
 * a pending invite they must accept — no auto-join), and watch live standings
 * computed from confirmed ActivityLogs inside the window.
 */
const METRICS = [
  ['load', 'Most load', 'pulse', 'flame'],
  ['workouts', 'Most workouts', 'barbell', 'barbell'],
  ['distance', 'Longest distance', 'map', 'walk'],
];
const DURATIONS = [
  ['This week', 7],
  ['2 weeks', 14],
  ['This month', 30],
];

const metricMeta = (m) => METRICS.find(([k]) => k === m) || METRICS[0];
const fmtScore = (metric, v) => {
  const n = Number(v) || 0;
  if (metric === 'distance') return `${n.toFixed(1)} km`;
  return `${Math.round(n)}`;
};
const statusColor = (status, C) =>
  status === 'active' ? C.success : status === 'upcoming' ? C.warning : C.textMuted;
const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`);

const CHALLENGES_TUTORIAL_STEPS = [
  {
    icon: '🏆',
    title: 'Create a Challenge',
    body: 'Tap the + button to start a friendly competition. Pick a name, a metric (load, workouts, or distance), and how long it runs.',
  },
  {
    icon: '👥',
    title: 'Invite Friends',
    body: 'Choose which trainee friends to invite. They will get a request they can accept or decline — no one joins automatically.',
  },
  {
    icon: '✅',
    title: 'Respond to Invites',
    body: 'When a friend invites you, it shows up at the top of this screen. Tap Join to compete, or the X to decline.',
  },
  {
    icon: '🥇',
    title: 'Live Standings',
    body: 'Tap any challenge to see the leaderboard, calculated live from real workouts — no manual score entry needed.',
  },
];

const ChallengesScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const { markChallengeInvitesSeen } = useSocial();
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState([]);
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    isTutorialDone('challenges').then((d) => { if (!d) setShowTutorial(true); });
  }, []);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState('load');
  const [durationDays, setDurationDays] = useState(7);
  const [friends, setFriends] = useState([]);
  const [invited, setInvited] = useState({}); // { friendId: true }
  const [saving, setSaving] = useState(false);

  // standings modal
  const [standingsOf, setStandingsOf] = useState(null);
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [chRes, invRes] = await Promise.all([
        getChallengesForUser(userId),
        getChallengeInvites(userId).catch(() => ({ data: [] })),
      ]);
      setItems(Array.isArray(chRes.data) ? chRes.data : []);
      const inv = Array.isArray(invRes.data) ? invRes.data : [];
      setInvites(inv);
      // The user is now looking at their invitations → clear the red "unseen"
      // badge on the Connect tab + Challenges chip (device-test #3). Pass the ids
      // we just fetched so it doesn't depend on the SocialContext poll timing.
      markChallengeInvitesSeen(inv.map((c) => c.challengeID ?? c.ChallengeID));
    } catch {
      setItems([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [userId, markChallengeInvitesSeen]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCreate = async () => {
    setTitle('');
    setMetric('load');
    setDurationDays(7);
    setInvited({});
    setShowCreate(true);
    try {
      const res = await getFriends(userId);
      // Only trainees can be invited — a coach-only friend can't log workouts,
      // so a challenge is pointless for them.
      const list = (Array.isArray(res.data) ? res.data : []).filter(
        (f) => (f.isTrainee ?? f.IsTrainee ?? true) !== false
      );
      setFriends(list);
    } catch {
      setFriends([]);
    }
  };

  const submitCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Name your challenge', 'Give the challenge a short title.');
      return;
    }
    setSaving(true);
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + durationDays);
      const inviteeCsv = Object.keys(invited).filter((k) => invited[k]).join(',');
      await createChallenge({
        creatorID: userId,
        title: title.trim(),
        metric,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        inviteeCsv: inviteeCsv || null,
      });
      setShowCreate(false);
      load();
    } catch (e) {
      Alert.alert('Could not create', e?.response?.data?.toString?.() || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openStandings = async (c) => {
    setStandingsOf(c);
    setStandings([]);
    setLoadingStandings(true);
    try {
      const res = await getChallengeStandings(c.challengeID ?? c.ChallengeID);
      setStandings(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStandings([]);
    } finally {
      setLoadingStandings(false);
    }
  };

  const respondInvite = async (c, accept) => {
    const id = c.challengeID ?? c.ChallengeID;
    setInvites((prev) => prev.filter((x) => (x.challengeID ?? x.ChallengeID) !== id));
    try { await respondChallengeInvite(id, userId, accept); } catch {}
    load();
  };

  const confirmLeave = (c) => {
    const id = c.challengeID ?? c.ChallengeID;
    Alert.alert('Leave challenge', `Leave "${c.title ?? c.Title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try { await leaveChallenge(id, userId); } catch {}
          load();
        },
      },
    ]);
  };

  const renderInvite = (item) => {
    const [, metricLabel, icon] = metricMeta(item.metric ?? item.Metric);
    return (
      <View key={`inv-${item.challengeID ?? item.ChallengeID}`} style={styles.inviteCard}>
        <View style={styles.inviteIconWrap}>
          <Ionicons name={icon} size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.inviteTitle} numberOfLines={1}>{item.title ?? item.Title}</Text>
          <Text style={styles.inviteMeta}>{metricLabel} · invited by {item.creatorName ?? item.CreatorName}</Text>
        </View>
        <TouchableOpacity style={styles.declineBtn} onPress={() => respondInvite(item, false)}>
          <Ionicons name="close" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={() => respondInvite(item, true)}>
          <Text style={styles.acceptBtnText}>Join</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCard = ({ item }) => {
    const status = item.status ?? item.Status;
    const m = item.metric ?? item.Metric;
    const [, metricLabel, icon] = metricMeta(m);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openStandings(item)} activeOpacity={0.85}>
        <View style={styles.cardTop}>
          <View style={styles.metricBadge}>
            <Ionicons name={icon} size={16} color={Colors.primary} />
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title ?? item.Title}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor(status, Colors) + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor(status, Colors) }]}>{status}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta}>
          {metricLabel} · {item.participantCount ?? item.ParticipantCount} in · by {item.creatorName ?? item.CreatorName}
        </Text>
        <View style={styles.cardActions}>
          <View style={styles.viewLinkRow}>
            <Ionicons name="podium-outline" size={15} color={Colors.primary} />
            <Text style={styles.viewLink}>View standings</Text>
          </View>
          <TouchableOpacity onPress={() => confirmLeave(item)} hitSlop={8}>
            <Text style={styles.leaveLink}>Leave</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Challenges</Text>
        <TouchableOpacity onPress={openCreate} hitSlop={8}>
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c, i) => String(c.challengeID ?? c.ChallengeID ?? i)}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            invites.length > 0 ? (
              <View style={styles.invitesSection}>
                <Text style={styles.invitesHeading}>INVITATIONS · {invites.length}</Text>
                {invites.map(renderInvite)}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="flag" size={34} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No challenges yet</Text>
              <Text style={styles.empty}>Start a friendly competition — most load, most workouts, or longest distance this week.</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={openCreate} activeOpacity={0.85}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyCtaText}>Create a challenge</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Create modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New challenge</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. October load battle"
                placeholderTextColor={Colors.textMuted}
                maxLength={120}
              />

              <Text style={styles.label}>Metric</Text>
              <View style={styles.rowWrap}>
                {METRICS.map(([k, lbl, icon]) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.opt, metric === k && styles.optActive]}
                    onPress={() => setMetric(k)}
                  >
                    <Ionicons name={icon} size={15} color={metric === k ? '#fff' : Colors.textSecondary} />
                    <Text style={[styles.optText, metric === k && styles.optTextActive]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Duration</Text>
              <View style={styles.rowWrap}>
                {DURATIONS.map(([lbl, days]) => (
                  <TouchableOpacity
                    key={days}
                    style={[styles.opt, durationDays === days && styles.optActive]}
                    onPress={() => setDurationDays(days)}
                  >
                    <Text style={[styles.optText, durationDays === days && styles.optTextActive]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Invite friends</Text>
              {friends.length === 0 ? (
                <Text style={styles.noFriends}>No trainee friends to invite yet.</Text>
              ) : (
                friends.map((f) => {
                  const fid = f.friendUserID ?? f.FriendUserID;
                  const on = !!invited[fid];
                  return (
                    <TouchableOpacity
                      key={fid}
                      style={styles.friendRow}
                      onPress={() => setInvited((prev) => ({ ...prev, [fid]: !on }))}
                    >
                      <Avatar user={{ fullName: f.fullName ?? f.FullName, profileImagePath: f.profileImagePath ?? f.ProfileImagePath }} size={32} />
                      <Text style={styles.friendName}>{f.fullName ?? f.FullName}</Text>
                      <Ionicons
                        name={on ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={on ? Colors.primary : Colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
              <Text style={styles.inviteHint}>Invited friends get a request they can accept or decline.</Text>
            </ScrollView>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setShowCreate(false)}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={submitCreate} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Standings modal */}
      <Modal visible={!!standingsOf} transparent animationType="fade" onRequestClose={() => setStandingsOf(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.standHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{standingsOf?.title ?? standingsOf?.Title}</Text>
              <TouchableOpacity onPress={() => setStandingsOf(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {loadingStandings ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {standings.length === 0 ? (
                  <Text style={styles.empty}>No scores logged in the window yet.</Text>
                ) : (
                  standings.map((s, i) => {
                    const mine = (s.userID ?? s.UserID) === userId;
                    const author = {
                      fullName: s.fullName ?? s.FullName,
                      profileImagePath: s.profileImagePath ?? s.ProfileImagePath,
                      equippedBadge: s.equippedBadge ?? s.EquippedBadge,
                      equippedTitle: s.equippedTitle ?? s.EquippedTitle,
                      equippedFrame: s.equippedFrame ?? s.EquippedFrame,
                    };
                    return (
                      <View key={s.userID ?? s.UserID ?? i} style={[styles.standRow, mine && styles.standRowMine]}>
                        <Text style={styles.standRank}>{medal(i)}</Text>
                        <View style={{ flex: 1 }}>
                          <UserProfileCard
                            user={author}
                            size={38}
                            subtitle={experienceLabel(s.experienceLevel ?? s.ExperienceLevel)}
                          />
                        </View>
                        <Text style={styles.standScore}>
                          {fmtScore(standingsOf?.metric ?? standingsOf?.Metric, s.score ?? s.Score)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      <ScreenTutorial
        visible={showTutorial}
        steps={CHALLENGES_TUTORIAL_STEPS}
        onFinish={() => { setShowTutorial(false); markTutorialDone('challenges'); }}
      />
    </SafeAreaView>
  );
};

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10,
  },
  title: { color: C.primary, fontSize: 22, fontWeight: '900', fontStyle: 'italic' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },

  // invitations
  invitesSection: { marginBottom: 8 },
  invitesHeading: { color: C.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  inviteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.cardBackground, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.primary, marginBottom: 8,
  },
  inviteIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  inviteTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  inviteMeta: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  declineBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: C.primary, borderRadius: 17, paddingHorizontal: 16, height: 34, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // challenge cards
  card: {
    backgroundColor: C.cardBackground, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricBadge: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.primary + '18', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '800', flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  cardMeta: { color: C.textSecondary, fontSize: 12, marginTop: 8 },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  viewLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  viewLink: { color: C.primary, fontSize: 13, fontWeight: '700' },
  leaveLink: { color: C.textMuted, fontSize: 13, fontWeight: '700' },

  // empty state
  emptyWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 70, paddingHorizontal: 32 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.primary + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '900', marginBottom: 6 },
  empty: { color: C.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20,
    backgroundColor: C.primary, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 22,
  },
  emptyCtaText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // modals
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 18 },
  modalCard: { backgroundColor: C.cardBackground, borderRadius: 16, padding: 18, maxHeight: '86%' },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '900', marginBottom: 6 },
  label: { color: C.textSecondary, fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: C.inputBackground, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: C.textPrimary, fontSize: 15, borderWidth: 1, borderColor: C.inputBorder,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.background,
  },
  optActive: { backgroundColor: C.primary, borderColor: C.primary },
  optText: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
  optTextActive: { color: '#fff' },
  noFriends: { color: C.textMuted, fontSize: 13, marginTop: 4 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  friendName: { color: C.textPrimary, fontSize: 14, flex: 1 },
  inviteHint: { color: C.textMuted, fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnGhost: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  btnGhostText: { color: C.textSecondary, fontSize: 15, fontWeight: '800' },
  btnPrimary: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  standHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  standRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8,
    borderRadius: 10, marginBottom: 6, backgroundColor: C.background,
  },
  standRowMine: { borderWidth: 1, borderColor: C.primary },
  standRank: { color: C.textSecondary, fontSize: 15, fontWeight: '900', width: 30, textAlign: 'center' },
  standScore: { color: C.primary, fontSize: 15, fontWeight: '900' },
});

export default ChallengesScreen;
