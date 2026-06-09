import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import {
  disconnectCoachTrainee,
  getCoachesForTrainee,
  getConversation,
  getFriends,
  removeFriend,
} from '../services/api';
import { useAuth } from '../api/AuthContext';
import { lastSeenText } from '../utils/experience';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * MyNetworkScreen (file kept as MyCoachScreen.js) — the trainee's relationship
 * hub. Two swipeable pages, Coaches ⇄ Friends, with a synced segmented header.
 * Each row opens the same user↔user ChatScreen; a trailing menu disconnects a
 * coach or unfriends a friend. Per-contact unread badges + (for friends) a
 * green presence dot + last-seen line. Swipe with a finger OR tap the segments.
 */

const { width: SCREEN_W } = Dimensions.get('window');

// Coach accessors (CoachContact: no presence fields).
const cName = (c) => c?.fullName ?? c?.FullName ?? 'Your coach';
const cEmail = (c) => c?.email ?? c?.Email;
const cImg = (c) => c?.profileImagePath ?? c?.ProfileImagePath;
const cUserId = (c) => c?.coachUserID ?? c?.CoachUserID;
const cCoachId = (c) => c?.coachID ?? c?.CoachID;

// Friend accessors (FriendContact: includes presence).
const fUserId = (f) => f?.friendUserID ?? f?.FriendUserID;
const fName = (f) => f?.fullName ?? f?.FullName ?? 'Friend';
const fImg = (f) => f?.profileImagePath ?? f?.ProfileImagePath;
const fOnline = (f) => f?.isOnline ?? f?.IsOnline ?? false;
const fLastSeen = (f) => f?.lastSeen ?? f?.LastSeen;

// Message accessors.
const mSender = (m) => m.senderID ?? m.SenderID;
const mText = (m) => m.text ?? m.Text ?? '';
const mSeen = (m) => m.isSeen ?? m.IsSeen ?? false;
const mImage = (m) => m.imagePath ?? m.ImagePath ?? null;

const MyCoachScreen = ({ route, navigation }) => {
  const { userId } = useAuth();
  const selfId = route.params?.selfId ?? userId;
  const styles = useThemedStyles(makeStyles);
  const pagerRef = useRef(null);

  const [tab, setTab] = useState(0); // 0 = coaches, 1 = friends
  const [coaches, setCoaches] = useState([]);
  const [friends, setFriends] = useState([]);
  const [unread, setUnread] = useState({});   // keyed by peer userId
  const [preview, setPreview] = useState({});  // keyed by peer userId → text
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!selfId) {
      setLoading(false);
      return;
    }
    let coachList = [];
    let friendList = [];
    try {
      const res = await getCoachesForTrainee(selfId);
      coachList = Array.isArray(res.data) ? res.data : [];
      setCoaches(coachList);
    } catch {
      // keep last
    }
    try {
      const res = await getFriends(selfId);
      friendList = Array.isArray(res.data) ? res.data : [];
      setFriends(friendList);
    } catch {
      // keep last
    }

    // Per-contact unread + last-message preview, derived client-side (each
    // person has only a handful of contacts, so this is cheap).
    const peers = [
      ...coachList.map(cUserId),
      ...friendList.map(fUserId),
    ].filter(Boolean);
    const counts = {};
    const previews = {};
    await Promise.all(
      peers.map(async (pid) => {
        try {
          const conv = await getConversation(selfId, pid);
          const rows = Array.isArray(conv.data) ? conv.data : [];
          counts[pid] = rows.filter((m) => mSender(m) === pid && !mSeen(m)).length;
          const last = rows[rows.length - 1];
          if (last) {
            const txt = mText(last) || (mImage(last) ? '📷 Photo' : '');
            previews[pid] = mSender(last) === selfId ? `You: ${txt}` : txt;
          }
        } catch {
          counts[pid] = 0;
        }
      })
    );
    setUnread(counts);
    setPreview(previews);
    setLoading(false);
  }, [selfId]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      load();
      const id = setInterval(() => {
        if (alive) load();
      }, 8000);
      return () => {
        alive = false;
        clearInterval(id);
      };
    }, [load])
  );

  const goTab = (idx) => {
    setTab(idx);
    pagerRef.current?.scrollTo({ x: idx * SCREEN_W, animated: true });
  };

  const onPagerScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx !== tab) setTab(idx);
  };

  const openChat = (peerId, name, img) =>
    navigation.navigate('Chat', { selfId, peerId, peerName: name, peerImagePath: img });

  const disconnectCoach = (c) => {
    Alert.alert(
      'Disconnect coach?',
      `Stop sharing your training with ${cName(c)}? You can reconnect later by scanning their QR code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectCoachTrainee(cCoachId(c), selfId);
              await load();
            } catch (e) {
              Alert.alert('Error', e.response?.data || 'Could not disconnect.');
            }
          },
        },
      ]
    );
  };

  const unfriend = (f) => {
    Alert.alert('Remove friend?', `Remove ${fName(f)} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(selfId, fUserId(f));
            await load();
          } catch (e) {
            Alert.alert('Error', e.response?.data || 'Could not remove friend.');
          }
        },
      },
    ]);
  };

  const renderRow = ({ key, name, img, online, showDot, sub, peerId, unreadN, onMenu }) => (
    <TouchableOpacity
      key={key}
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => openChat(peerId, name, img)}
    >
      <Avatar imagePath={img} name={name} size={52} showDot={showDot} online={online} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, unreadN > 0 && styles.rowNameUnread]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.rowSub, unreadN > 0 && styles.rowSubUnread]} numberOfLines={1}>{sub}</Text>
      </View>
      {unreadN > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{unreadN > 99 ? '99+' : unreadN}</Text>
        </View>
      )}
      <TouchableOpacity onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuBtn}>
        <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Network" subtitle="Coaches & friends" onBack={() => navigation.goBack()} />

      {/* Segmented header */}
      <View style={styles.segment}>
        <TouchableOpacity style={[styles.segBtn, tab === 0 && styles.segBtnActive]} onPress={() => goTab(0)}>
          <Ionicons name="ribbon" size={16} color={tab === 0 ? '#fff' : Colors.textSecondary} />
          <Text style={[styles.segText, tab === 0 && styles.segTextActive]}>Coaches ({coaches.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segBtn, tab === 1 && styles.segBtnActive]} onPress={() => goTab(1)}>
          <Ionicons name="people" size={16} color={tab === 1 ? '#fff' : Colors.textSecondary} />
          <Text style={[styles.segText, tab === 1 && styles.segTextActive]}>Friends ({friends.length})</Text>
        </TouchableOpacity>
      </View>

      {loading && coaches.length === 0 && friends.length === 0 ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPagerScroll}
        >
          {/* Page 0 — Coaches */}
          <ScrollView style={{ width: SCREEN_W }} contentContainerStyle={styles.page}>
            {coaches.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="ribbon-outline" size={50} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No coach connected</Text>
                <Text style={styles.emptyText}>Scan a coach&apos;s QR code from the Connect screen to link up.</Text>
              </View>
            ) : (
              coaches.map((c) =>
                renderRow({
                  key: `c${cUserId(c) ?? cCoachId(c)}`,
                  name: cName(c),
                  img: cImg(c),
                  showDot: false,
                  online: false,
                  sub: preview[cUserId(c)] || cEmail(c) || 'Your coach · tap to chat',
                  peerId: cUserId(c),
                  unreadN: unread[cUserId(c)] || 0,
                  onMenu: () => disconnectCoach(c),
                })
              )
            )}
          </ScrollView>

          {/* Page 1 — Friends */}
          <ScrollView style={{ width: SCREEN_W }} contentContainerStyle={styles.page}>
            {friends.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={50} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptyText}>Find athletes near you on the Connect tab and send a friend request.</Text>
              </View>
            ) : (
              friends.map((f) =>
                renderRow({
                  key: `f${fUserId(f)}`,
                  name: fName(f),
                  img: fImg(f),
                  showDot: true,
                  online: fOnline(f),
                  sub: preview[fUserId(f)] || lastSeenText(fLastSeen(f), fOnline(f)),
                  peerId: fUserId(f),
                  unreadN: unread[fUserId(f)] || 0,
                  onMenu: () => unfriend(f),
                })
              )
            )}
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
};

const makeStyles = (C) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    segment: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
    segBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 9, borderRadius: 10, backgroundColor: C.cardBackground,
      borderWidth: 1, borderColor: C.border,
    },
    segBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    segText: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
    segTextActive: { color: '#fff' },

    page: { padding: 16, paddingBottom: 40 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.cardBackground,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 10,
    },
    rowBody: { flex: 1 },
    rowName: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
    rowNameUnread: { fontWeight: '900' },
    rowSub: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
    rowSubUnread: { color: C.textPrimary, fontWeight: '700' },
    unreadBadge: {
      minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
      backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center',
    },
    unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    menuBtn: { paddingLeft: 4, paddingVertical: 4 },

    empty: { alignItems: 'center', paddingVertical: 80 },
    emptyTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 12 },
    emptyText: { color: C.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 36, lineHeight: 19 },
  });

export default MyCoachScreen;
