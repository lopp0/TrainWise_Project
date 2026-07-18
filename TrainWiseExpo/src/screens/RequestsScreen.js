import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import { useAuth } from '../api/AuthContext';
import { useSocial } from '../api/SocialContext';
import { sendLocalNotification } from '../api/NotificationService';
import {
  getFriendRequests,
  respondFriendRequest,
  getCoachOffersForTrainee,
  respondCoachOffer,
} from '../services/api';
import { experienceLabel } from '../utils/experience';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * RequestsScreen — the Connect inbox. Shows incoming friend requests and (for
 * trainees) coaching offers, each with Accept / Decline. Accepting a friend
 * fires a local "you're now connected" push and refreshes the global badge.
 */
const RequestsScreen = ({ navigation }) => {
  const { userId, user } = useAuth();
  const { refresh } = useSocial();
  const styles = useThemedStyles(makeStyles);

  const [requests, setRequests] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null); // friendshipID/offerID currently acting

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const reqRes = await getFriendRequests(userId);
      setRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
    } catch {
      // keep last
    }
    if (user?.isTrainee !== false) {
      try {
        const offRes = await getCoachOffersForTrainee(userId);
        setOffers(Array.isArray(offRes.data) ? offRes.data : []);
      } catch {
        // keep last
      }
    }
    setLoading(false);
  }, [userId, user?.isTrainee]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const respondFriend = async (req, accept) => {
    const fid = req.friendshipID ?? req.FriendshipID;
    setBusyId(`f${fid}`);
    try {
      await respondFriendRequest(fid, accept);
      setRequests((prev) => prev.filter((r) => (r.friendshipID ?? r.FriendshipID) !== fid));
      if (accept) {
        sendLocalNotification(
          'New friend 🎉',
          `You and ${req.fullName ?? req.FullName} are now connected. Say hi!`
        );
      }
      refresh();
    } catch (e) {
      Alert.alert('Error', e?.response?.data || 'Could not respond. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const respondOffer = async (offer, accept) => {
    const oid = offer.offerID ?? offer.OfferID;
    setBusyId(`o${oid}`);
    try {
      await respondCoachOffer(oid, accept);
      setOffers((prev) => prev.filter((o) => (o.offerID ?? o.OfferID) !== oid));
      if (accept) {
        sendLocalNotification(
          'New coach 🏋️',
          `${offer.fullName ?? offer.FullName} is now your coach. Open My Network to message them.`
        );
      }
      refresh();
    } catch (e) {
      Alert.alert('Error', e?.response?.data || 'Could not respond. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const total = requests.length + offers.length;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Requests" subtitle="Friend & coaching invitations" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 50 }} />
        ) : total === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
            <Text style={styles.emptyText}>New friend requests and coaching offers will show up here.</Text>
          </View>
        ) : (
          <>
            {requests.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Friend requests</Text>
                {requests.map((req) => {
                  const fid = req.friendshipID ?? req.FriendshipID;
                  const busy = busyId === `f${fid}`;
                  return (
                    <View key={`f${fid}`} style={styles.card}>
                      <Avatar
                        imagePath={req.profileImagePath ?? req.ProfileImagePath}
                        name={req.fullName ?? req.FullName}
                        size={48}
                        showDot
                        online={req.isOnline ?? req.IsOnline}
                      />
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName} numberOfLines={1}>{req.fullName ?? req.FullName}</Text>
                        <Text style={styles.cardMeta}>{experienceLabel(req.experienceLevel ?? req.ExperienceLevel)} · wants to connect</Text>
                      </View>
                      {busy ? (
                        <ActivityIndicator color={Colors.primary} style={{ width: 72 }} />
                      ) : (
                        <View style={styles.actions}>
                          <TouchableOpacity style={styles.acceptBtn} onPress={() => respondFriend(req, true)}>
                            <Ionicons name="checkmark" size={20} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.declineBtn} onPress={() => respondFriend(req, false)}>
                            <Ionicons name="close" size={20} color={Colors.danger} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {offers.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Coaching offers</Text>
                {offers.map((offer) => {
                  const oid = offer.offerID ?? offer.OfferID;
                  const busy = busyId === `o${oid}`;
                  return (
                    <View key={`o${oid}`} style={styles.card}>
                      <Avatar
                        imagePath={offer.profileImagePath ?? offer.ProfileImagePath}
                        name={offer.fullName ?? offer.FullName}
                        size={48}
                      />
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName} numberOfLines={1}>{offer.fullName ?? offer.FullName}</Text>
                        <Text style={styles.cardMeta}>Coach · wants to train you</Text>
                      </View>
                      {busy ? (
                        <ActivityIndicator color={Colors.primary} style={{ width: 72 }} />
                      ) : (
                        <View style={styles.actions}>
                          <TouchableOpacity style={styles.acceptBtn} onPress={() => respondOffer(offer, true)}>
                            <Ionicons name="checkmark" size={20} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.declineBtn} onPress={() => respondOffer(offer, false)}>
                            <Ionicons name="close" size={20} color={Colors.danger} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const makeStyles = (C) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { padding: 16, paddingBottom: 40 },
    sectionTitle: { color: C.primary, fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 },
    card: {
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
    cardBody: { flex: 1 },
    cardName: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
    cardMeta: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
    actions: { flexDirection: 'row', gap: 8 },
    acceptBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.success, alignItems: 'center', justifyContent: 'center',
    },
    declineBtn: {
      width: 40, height: 40, borderRadius: 20,
      borderWidth: 1.5, borderColor: C.danger, alignItems: 'center', justifyContent: 'center',
    },
    empty: { alignItems: 'center', paddingVertical: 70 },
    emptyTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 12 },
    emptyText: { color: C.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 30, lineHeight: 19 },
  });

export default RequestsScreen;
