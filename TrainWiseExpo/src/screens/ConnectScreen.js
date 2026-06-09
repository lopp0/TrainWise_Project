import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Dimensions,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../api/AuthContext';
import { useSocial } from '../api/SocialContext';
import {
  getGyms,
  getNearbyUsers,
  getGymCoaches,
  getUserMiniProfile,
  updateMyLocation,
  sendFriendRequest,
  removeFriend,
  sendCoachOffer,
  addCoachToGym,
  removeCoachFromGym,
} from '../services/api';
import Avatar from '../components/Avatar';
import { experienceLabel } from '../utils/experience';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

// Lazy, crash-safe expo-maps load (mirrors WorkoutRouteScreen) so the screen
// still works as a list if the native map module isn't in this build.
let GoogleMaps = null;
try {
  GoogleMaps = require('expo-maps').GoogleMaps;
} catch (_e) {
  GoogleMaps = null;
}

const { height: SCREEN_H } = Dimensions.get('window');
// Fallback center (Netanya) so the seeded demo data still appears if the user
// denies location.
const FALLBACK = { latitude: 32.3215, longitude: 34.8532 };
const VIEW_LABEL = { trainees: 'Trainees', coaches: 'Coaches', gyms: 'Gyms' };

const ConnectScreen = ({ navigation }) => {
  const { userId, user } = useAuth();
  const { pendingTotal } = useSocial();
  const styles = useThemedStyles(makeStyles);

  const isCoachViewer = !!user?.isCoach;

  const [coords, setCoords] = useState(null);
  const [locDenied, setLocDenied] = useState(false);
  const [gyms, setGyms] = useState([]);
  const [people, setPeople] = useState([]);
  const [view, setView] = useState('trainees'); // 'trainees' | 'coaches' | 'gyms'
  const [sort, setSort] = useState('nearest');  // 'nearest' | 'az'
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Draggable divider — let the user resize the map vs the list (#4).
  const MIN_MAP = Math.round(SCREEN_H * 0.16);
  const MAX_MAP = Math.round(SCREEN_H * 0.6);
  const [mapHeight, setMapHeight] = useState(Math.round(SCREEN_H * 0.3));
  const mapHeightRef = useRef(Math.round(SCREEN_H * 0.3));
  const dragStart = useRef(0);
  const setMap = (h) => {
    const clamped = Math.max(MIN_MAP, Math.min(MAX_MAP, h));
    mapHeightRef.current = clamped;
    setMapHeight(clamped);
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        dragStart.current = mapHeightRef.current;
      },
      onPanResponderMove: (_, g) => setMap(dragStart.current + g.dy),
    })
  ).current;

  // Detail sheets
  const [profile, setProfile] = useState(null);     // mini-profile object
  const [profileLoading, setProfileLoading] = useState(false);
  const [acting, setActing] = useState(false);      // friend/coach action in-flight
  const [gym, setGym] = useState(null);             // selected gym
  const [gymCoaches, setGymCoaches] = useState([]);
  const [gymLoading, setGymLoading] = useState(false);

  const didLoad = useRef(false);
  const coordsRef = useRef(null); // latest center for focus-refresh (avoids stale closure)

  const loadData = useCallback(
    async (center) => {
      if (!center || !userId) return;
      try {
        // ~25 km covers all of Netanya and reaches Ruppin Academic Center
        // (~6 km NE) while keeping the results local to the user's area.
        const [g, p] = await Promise.all([
          getGyms(center.latitude, center.longitude, 25),
          getNearbyUsers(userId, center.latitude, center.longitude, 25),
        ]);
        setGyms(Array.isArray(g.data) ? g.data : []);
        setPeople(Array.isArray(p.data) ? p.data : []);
      } catch {
        // leave whatever we had; the list shows an empty state
      }
    },
    [userId]
  );

  const resolveLocationAndLoad = useCallback(async () => {
    let center = FALLBACK;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocDenied(false);
        let pos = await Location.getLastKnownPositionAsync();
        if (!pos) pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (pos?.coords) {
          center = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          // Publish our location so we surface in others' "nearby" LIST. Exact
          // coordinates of users are never plotted on anyone's map (privacy).
          updateMyLocation(userId, center.latitude, center.longitude).catch(() => {});
        }
      } else {
        setLocDenied(true);
      }
    } catch {
      setLocDenied(true);
    }
    setCoords(center);
    coordsRef.current = center;
    await loadData(center);
    setLoading(false);
  }, [userId, loadData]);

  useFocusEffect(
    useCallback(() => {
      if (!didLoad.current) {
        didLoad.current = true;
        resolveLocationAndLoad();
      } else if (coordsRef.current) {
        // Refresh data (presence/new pins) on subsequent focuses.
        loadData(coordsRef.current);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolveLocationAndLoad])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(coords || FALLBACK);
    setRefreshing(false);
  };

  // ── Detail openers ─────────────────────────────────────────────────────
  const openUser = async (targetId) => {
    if (targetId === userId) return;
    setProfile({ userID: targetId, _loading: true });
    setProfileLoading(true);
    try {
      const res = await getUserMiniProfile(userId, targetId);
      setProfile(res.data);
    } catch {
      Alert.alert('Could not load profile', 'Please try again.');
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const openGym = async (g) => {
    setGym(g);
    setGymLoading(true);
    setGymCoaches([]);
    try {
      const res = await getGymCoaches(g.gymID ?? g.GymID);
      setGymCoaches(Array.isArray(res.data) ? res.data : []);
    } catch {
      setGymCoaches([]);
    } finally {
      setGymLoading(false);
    }
  };

  const onMarkerClick = (marker) => {
    const id = marker?.id || '';
    if (id.startsWith('gym-')) {
      const gid = Number(id.slice(4));
      const g = gyms.find((x) => (x.gymID ?? x.GymID) === gid);
      if (g) openGym(g);
    } else if (id.startsWith('user-')) {
      openUser(Number(id.slice(5)));
    }
  };

  // ── Friend / coach actions ───────────────────────────────────────────────
  const doAddFriend = async () => {
    if (!profile) return;
    setActing(true);
    try {
      await sendFriendRequest(userId, profile.userID);
      setProfile((p) => ({ ...p, friendStatus: 'pending', friendRequesterID: userId }));
    } catch (e) {
      Alert.alert('Error', e?.response?.data || 'Could not send request.');
    } finally {
      setActing(false);
    }
  };

  const doUnfriend = async () => {
    if (!profile) return;
    setActing(true);
    try {
      await removeFriend(userId, profile.userID);
      setProfile((p) => ({ ...p, friendStatus: null, friendRequesterID: null, friendshipID: null }));
    } catch (e) {
      Alert.alert('Error', e?.response?.data || 'Could not remove friend.');
    } finally {
      setActing(false);
    }
  };

  const doOfferCoach = async () => {
    if (!profile) return;
    setActing(true);
    try {
      await sendCoachOffer(userId, profile.userID);
      setProfile((p) => ({ ...p, _offerSent: true }));
      Alert.alert('Offer sent', `${profile.fullName} will be notified you offered to coach them.`);
    } catch (e) {
      Alert.alert('Error', e?.response?.data || 'Could not send offer.');
    } finally {
      setActing(false);
    }
  };

  const messageUser = (target) => {
    const peerId = target.userID ?? target.UserID;
    setProfile(null);
    setGym(null);
    navigation.navigate('Chat', {
      selfId: userId,
      peerId,
      peerName: target.fullName ?? target.FullName,
      peerImagePath: target.profileImagePath ?? target.ProfileImagePath,
    });
  };

  const iAmListedAtGym = gymCoaches.some((c) => (c.userID ?? c.UserID) === userId);
  const toggleGymListing = async () => {
    if (!gym) return;
    const gid = gym.gymID ?? gym.GymID;
    setActing(true);
    try {
      if (iAmListedAtGym) {
        await removeCoachFromGym(gid, userId);
      } else {
        await addCoachToGym(gid, userId);
      }
      const res = await getGymCoaches(gid);
      setGymCoaches(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      Alert.alert('Error', e?.response?.data || 'Could not update gym listing.');
    } finally {
      setActing(false);
    }
  };

  // ── Markers ──────────────────────────────────────────────────────────────
  // Only GYMS (public places) are plotted. Other users' exact coordinates are
  // never shown on the map for privacy — people appear only as a proximity list.
  const markers = gyms.map((g) => ({
    id: `gym-${g.gymID ?? g.GymID}`,
    coordinates: { latitude: g.latitude ?? g.Latitude, longitude: g.longitude ?? g.Longitude },
    title: g.name ?? g.Name,
    snippet: 'Gym',
  }));

  const cameraPosition = coords ? { coordinates: coords, zoom: 12.5 } : undefined;

  const sortByName = (a, b, name) => (name(a) || '').localeCompare(name(b) || '');
  const sortByDist = (a, b) => (a.distanceKm ?? a.DistanceKm ?? 0) - (b.distanceKm ?? b.DistanceKm ?? 0);

  // ── Render ───────────────────────────────────────────────────────────────
  // wantCoach=true → coaches, false → trainees. No exact distance shown (#1).
  const renderPeople = (wantCoach) => {
    const filtered = people.filter((u) =>
      wantCoach ? (u.isCoach ?? u.IsCoach) : (u.isTrainee ?? u.IsTrainee)
    );
    const list = [...filtered].sort((a, b) =>
      sort === 'az' ? sortByName(a, b, (x) => x.fullName ?? x.FullName) : sortByDist(a, b)
    );
    if (list.length === 0) {
      return (
        <Text style={styles.emptyText}>
          No {wantCoach ? 'coaches' : 'athletes'} nearby yet. Pull to refresh.
        </Text>
      );
    }
    return list.map((u) => {
      const id = u.userID ?? u.UserID;
      const coach = u.isCoach ?? u.IsCoach;
      return (
        <TouchableOpacity key={id} style={styles.row} activeOpacity={0.8} onPress={() => openUser(id)}>
          <Avatar
            imagePath={u.profileImagePath ?? u.ProfileImagePath}
            name={u.fullName ?? u.FullName}
            size={50}
            showDot
            online={u.isOnline ?? u.IsOnline}
          />
          <View style={styles.rowBody}>
            <Text style={styles.rowName} numberOfLines={1}>{u.fullName ?? u.FullName}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {experienceLabel(u.experienceLevel ?? u.ExperienceLevel)} · Nearby
            </Text>
          </View>
          <View style={[styles.roleTag, coach && styles.roleTagCoach]}>
            <Text style={[styles.roleTagText, coach && styles.roleTagTextCoach]}>{coach ? 'Coach' : 'Athlete'}</Text>
          </View>
        </TouchableOpacity>
      );
    });
  };

  const renderGyms = () => {
    const list = [...gyms].sort((a, b) =>
      sort === 'az' ? sortByName(a, b, (x) => x.name ?? x.Name) : sortByDist(a, b)
    );
    if (list.length === 0) {
      return <Text style={styles.emptyText}>No gyms nearby yet. Pull to refresh.</Text>;
    }
    return list.map((g) => {
      const id = g.gymID ?? g.GymID;
      const city = g.city ?? g.City;
      const coachN = g.coachCount ?? g.CoachCount ?? 0;
      return (
        <TouchableOpacity key={id} style={styles.row} activeOpacity={0.8} onPress={() => openGym(g)}>
          <View style={styles.gymIcon}>
            <Ionicons name="barbell" size={24} color={Colors.primary} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowName} numberOfLines={1}>{g.name ?? g.Name}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {city ? `${city} · ` : ''}{(g.distanceKm ?? g.DistanceKm ?? 0).toFixed(1)} km · {coachN} coach{coachN === 1 ? '' : 'es'}
            </Text>
          </View>
          {(g.rating ?? g.Rating) != null && (
            <View style={styles.ratingTag}>
              <Ionicons name="star" size={12} color="#FFC107" />
              <Text style={styles.ratingText}>{Number(g.rating ?? g.Rating).toFixed(1)}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Connect</Text>
          <Text style={styles.subtitle}>Gyms & athletes around you</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => navigation.navigate('MyNetwork', { selfId: userId })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="people-circle-outline" size={26} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => navigation.navigate('Requests')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications" size={24} color={Colors.primary} />
            {pendingTotal > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{pendingTotal > 99 ? '99+' : pendingTotal}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Map (resizable) */}
      <View style={[styles.mapWrap, { height: mapHeight }]}>
        {GoogleMaps?.View && coords ? (
          <GoogleMaps.View
            style={styles.map}
            cameraPosition={cameraPosition}
            markers={markers}
            properties={{ isMyLocationEnabled: !locDenied }}
            onMarkerClick={onMarkerClick}
          />
        ) : (
          <View style={styles.mapFallback}>
            {loading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="map-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.mapFallbackText}>
                  {GoogleMaps?.View ? 'Locating…' : 'Map module not in this build. Use the list below.'}
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* Draggable divider — slide up/down to resize the map */}
      <View style={styles.dragHandle} {...pan.panHandlers}>
        <View style={styles.dragBar} />
      </View>

      {/* Filter bar — tap to open the filter menu (Trainees / Coaches / Gyms + sort) */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterBar} onPress={() => setFilterOpen(true)} activeOpacity={0.8}>
          <Ionicons name="options-outline" size={18} color={Colors.primary} />
          <Text style={styles.filterBarText}>
            {VIEW_LABEL[view]} · {sort === 'az' ? 'A-Z' : 'Nearest'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.filterCount}>
          {view === 'gyms' ? `${gyms.length} gyms` : `${people.filter((u) => (view === 'coaches' ? (u.isCoach ?? u.IsCoach) : (u.isTrainee ?? u.IsTrainee))).length}`}
        </Text>
      </View>

      {locDenied && (
        <Text style={styles.locHint}>
          Location off. Showing the demo area; enable location to see who&apos;s really around you.
        </Text>
      )}

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : view === 'gyms' ? (
          renderGyms()
        ) : (
          renderPeople(view === 'coaches')
        )}
      </ScrollView>

      {/* Filter menu */}
      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setFilterOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.filterGroupLabel}>SHOW</Text>
            {[
              ['trainees', 'Trainees', 'walk'],
              ['coaches', 'Coaches', 'ribbon'],
              ['gyms', 'Gyms', 'barbell'],
            ].map(([key, label, icon]) => (
              <TouchableOpacity
                key={key}
                style={styles.filterOption}
                onPress={() => { setView(key); setFilterOpen(false); }}
              >
                <Ionicons name={icon} size={18} color={view === key ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.filterOptionText, view === key && styles.filterOptionTextActive]}>{label}</Text>
                {view === key && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
            <View style={styles.filterDivider} />
            <Text style={styles.filterGroupLabel}>SORT BY</Text>
            {[
              ['nearest', 'Nearest to you', 'navigate'],
              ['az', 'Name (A-Z)', 'list'],
            ].map(([key, label, icon]) => (
              <TouchableOpacity
                key={key}
                style={styles.filterOption}
                onPress={() => { setSort(key); setFilterOpen(false); }}
              >
                <Ionicons name={icon} size={18} color={sort === key ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.filterOptionText, sort === key && styles.filterOptionTextActive]}>{label}</Text>
                {sort === key && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── User mini-profile sheet ── */}
      <Modal visible={!!profile} transparent animationType="slide" onRequestClose={() => setProfile(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setProfile(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            {profileLoading || profile?._loading ? (
              <ActivityIndicator color={Colors.primary} size="large" style={{ marginVertical: 30 }} />
            ) : profile ? (
              <UserSheet
                styles={styles}
                profile={profile}
                viewerIsCoach={isCoachViewer}
                viewerId={userId}
                acting={acting}
                onAddFriend={doAddFriend}
                onUnfriend={doUnfriend}
                onOfferCoach={doOfferCoach}
                onMessage={() => messageUser(profile)}
                onRespond={() => {
                  setProfile(null);
                  navigation.navigate('Requests');
                }}
                onClose={() => setProfile(null)}
              />
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Gym detail sheet ── */}
      <Modal visible={!!gym} transparent animationType="slide" onRequestClose={() => setGym(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setGym(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            {gym && (
              <GymSheet
                styles={styles}
                gym={gym}
                coaches={gymCoaches}
                loading={gymLoading}
                viewerIsCoach={isCoachViewer}
                iAmListed={iAmListedAtGym}
                acting={acting}
                onToggleListing={toggleGymListing}
                onOpenCoach={(cid) => {
                  // Open the coach's profile (where Add-friend lives) — you can
                  // only message someone once you're connected, no chat-first.
                  setGym(null);
                  openUser(cid);
                }}
                onClose={() => setGym(null)}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// ── User mini-profile sheet content ────────────────────────────────────────
const UserSheet = ({ styles, profile, viewerIsCoach, viewerId, acting, onAddFriend, onUnfriend, onOfferCoach, onMessage, onRespond, onClose }) => {
  const status = profile.friendStatus;
  const iRequested = profile.friendRequesterID === viewerId;
  const isFriend = status === 'accepted';
  const isTrainee = profile.isTrainee;
  const canOfferCoach = viewerIsCoach && isTrainee && profile.userID !== viewerId;

  return (
    <>
      <View style={styles.sheetHandle} />
      <View style={styles.sheetTop}>
        <Avatar
          imagePath={profile.profileImagePath}
          name={profile.fullName}
          size={72}
          showDot
          online={profile.isOnline}
        />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.sheetName}>{profile.fullName}</Text>
          <Text style={styles.sheetSub}>
            {experienceLabel(profile.experienceLevel)}
            {profile.isCoach ? ' · Coach' : ''}
            {profile.isOnline ? ' · Online' : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={24} color={styles._muted} />
        </TouchableOpacity>
      </View>

      {/* Top activity types — find common ground */}
      <Text style={styles.sheetLabel}>Top workout types</Text>
      <View style={styles.chipsWrap}>
        {(profile.topActivities ? profile.topActivities.split(',').map((s) => s.trim()) : []).filter(Boolean).length ? (
          profile.topActivities.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
            <View key={t} style={styles.actChip}>
              <Text style={styles.actChipText}>{t}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.sheetSub}>No workouts logged yet</Text>
        )}
      </View>

      {/* Friend actions */}
      <View style={styles.sheetActions}>
        {isFriend ? (
          <>
            <TouchableOpacity style={[styles.actBtn, styles.actBtnPrimary]} onPress={onMessage} activeOpacity={0.85}>
              <Ionicons name="chatbubbles" size={18} color="#fff" />
              <Text style={styles.actBtnTextPrimary}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actBtn, styles.actBtnDanger]} onPress={onUnfriend} disabled={acting} activeOpacity={0.85}>
              {acting ? <ActivityIndicator color={styles._danger} /> : (
                <>
                  <Ionicons name="person-remove" size={18} color={styles._danger} />
                  <Text style={styles.actBtnTextDanger}>Unfriend</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : status === 'pending' && iRequested ? (
          <View style={[styles.actBtn, styles.actBtnMuted]}>
            <Ionicons name="hourglass" size={18} color={styles._muted} />
            <Text style={styles.actBtnTextMuted}>Request sent</Text>
          </View>
        ) : status === 'pending' && !iRequested ? (
          <TouchableOpacity style={[styles.actBtn, styles.actBtnPrimary]} onPress={onRespond} activeOpacity={0.85}>
            <Ionicons name="person-add" size={18} color="#fff" />
            <Text style={styles.actBtnTextPrimary}>Respond to request</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.actBtn, styles.actBtnPrimary]} onPress={onAddFriend} disabled={acting} activeOpacity={0.85}>
            {acting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="person-add" size={18} color="#fff" />
                <Text style={styles.actBtnTextPrimary}>Add friend</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Coach offer (coach viewing a trainee) */}
      {canOfferCoach && (
        <TouchableOpacity
          style={[styles.offerBtn, profile._offerSent && styles.actBtnMuted]}
          onPress={onOfferCoach}
          disabled={acting || profile._offerSent}
          activeOpacity={0.85}
        >
          <Ionicons name="ribbon" size={18} color={profile._offerSent ? styles._muted : Colors.primary} />
          <Text style={[styles.offerBtnText, profile._offerSent && styles.actBtnTextMuted]}>
            {profile._offerSent ? 'Coaching offer sent' : 'Offer to coach this athlete'}
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
};

// ── Gym detail sheet content ────────────────────────────────────────────────
const GymSheet = ({ styles, gym, coaches, loading, viewerIsCoach, iAmListed, acting, onToggleListing, onOpenCoach, onClose }) => (
  <>
    <View style={styles.sheetHandle} />
    <View style={styles.sheetTop}>
      <View style={styles.gymIconLg}>
        <Ionicons name="barbell" size={28} color={Colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.sheetName}>{gym.name ?? gym.Name}</Text>
        <Text style={styles.sheetSub} numberOfLines={2}>{gym.address ?? gym.Address}</Text>
      </View>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={24} color={styles._muted} />
      </TouchableOpacity>
    </View>

    <View style={styles.gymMetaRow}>
      {(gym.rating ?? gym.Rating) != null && (
        <View style={styles.gymMeta}>
          <Ionicons name="star" size={14} color="#FFC107" />
          <Text style={styles.gymMetaText}>{Number(gym.rating ?? gym.Rating).toFixed(1)}</Text>
        </View>
      )}
      <View style={styles.gymMeta}>
        <Ionicons name="navigate" size={14} color={Colors.primary} />
        <Text style={styles.gymMetaText}>{(gym.distanceKm ?? gym.DistanceKm ?? 0).toFixed(1)} km</Text>
      </View>
      {(gym.phone ?? gym.Phone) && (
        <View style={styles.gymMeta}>
          <Ionicons name="call" size={14} color={Colors.primary} />
          <Text style={styles.gymMetaText}>{gym.phone ?? gym.Phone}</Text>
        </View>
      )}
    </View>

    {!!(gym.description ?? gym.Description) && (
      <Text style={styles.gymDesc}>{gym.description ?? gym.Description}</Text>
    )}

    {viewerIsCoach && (
      <TouchableOpacity
        style={[styles.offerBtn, iAmListed && styles.actBtnMuted]}
        onPress={onToggleListing}
        disabled={acting}
        activeOpacity={0.85}
      >
        {acting ? <ActivityIndicator color={Colors.primary} /> : (
          <>
            <Ionicons name={iAmListed ? 'checkmark-circle' : 'add-circle'} size={18} color={iAmListed ? styles._muted : Colors.primary} />
            <Text style={[styles.offerBtnText, iAmListed && styles.actBtnTextMuted]}>
              {iAmListed ? "You're recommended here. Tap to remove." : 'Recommend me as a coach here'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    )}

    <Text style={styles.sheetLabel}>Recommended coaches</Text>
    {loading ? (
      <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
    ) : coaches.length === 0 ? (
      <Text style={styles.sheetSub}>No coaches recommended here yet.</Text>
    ) : (
      <ScrollView style={{ maxHeight: SCREEN_H * 0.3 }}>
        {coaches.map((c) => {
          const cid = c.userID ?? c.UserID;
          return (
            <TouchableOpacity
              key={cid}
              style={styles.coachRow}
              activeOpacity={0.8}
              onPress={() => onOpenCoach(cid)}
            >
              <Avatar
                imagePath={c.profileImagePath ?? c.ProfileImagePath}
                name={c.fullName ?? c.FullName}
                size={42}
                showDot
                online={c.isOnline ?? c.IsOnline}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.rowName} numberOfLines={1}>{c.fullName ?? c.FullName}</Text>
                <Text style={styles.rowMeta}>{experienceLabel(c.experienceLevel ?? c.ExperienceLevel)} coach</Text>
              </View>
              <View style={styles.addChip}>
                <Ionicons name="person-add" size={15} color={Colors.primary} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    )}
  </>
);

const makeStyles = (C) => {
  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 10,
    },
    title: { color: C.primary, fontSize: 28, fontWeight: '900', fontStyle: 'italic' },
    subtitle: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    bell: { padding: 4 },
    bellBadge: {
      position: 'absolute',
      top: -2,
      right: -4,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: C.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.background,
    },
    bellBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    mapWrap: { height: SCREEN_H * 0.30, backgroundColor: C.cardBackgroundLight },
    map: { flex: 1 },
    mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    mapFallbackText: { color: C.textMuted, fontSize: 13, marginTop: 8, textAlign: 'center' },

    dragHandle: { height: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
    dragBar: { width: 46, height: 5, borderRadius: 3, backgroundColor: C.textMuted },

    segment: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    segBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: C.cardBackground,
      borderWidth: 1,
      borderColor: C.border,
    },
    segBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    segText: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
    segTextActive: { color: '#fff' },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: C.cardBackground,
      borderWidth: 1,
      borderColor: C.border,
    },
    searchInput: { flex: 1, color: C.textPrimary, fontSize: 14, padding: 0 },

    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
    },
    filterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: C.cardBackground,
      borderWidth: 1,
      borderColor: C.border,
    },
    filterBarText: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
    filterCount: { color: C.textMuted, fontSize: 12, fontWeight: '700' },
    filterGroupLabel: {
      color: C.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1,
      marginTop: 6, marginBottom: 4,
    },
    filterOption: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 13,
    },
    filterOptionText: { flex: 1, color: C.textSecondary, fontSize: 15, fontWeight: '600' },
    filterOptionTextActive: { color: C.textPrimary, fontWeight: '800' },
    filterDivider: { height: 1, backgroundColor: C.border, marginVertical: 8 },

    locHint: {
      color: C.textMuted,
      fontSize: 11,
      fontStyle: 'italic',
      paddingHorizontal: 16,
      marginBottom: 4,
    },

    listContent: { paddingHorizontal: 16, paddingBottom: 24 },
    emptyText: { color: C.textMuted, textAlign: 'center', marginTop: 30, fontSize: 14 },

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
    rowMeta: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
    gymIcon: {
      width: 50, height: 50, borderRadius: 12,
      backgroundColor: C.cardBackgroundLight, alignItems: 'center', justifyContent: 'center',
    },
    roleTag: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
      backgroundColor: C.cardBackgroundLight,
    },
    roleTagCoach: { backgroundColor: C.primary },
    roleTagText: { color: C.textSecondary, fontSize: 11, fontWeight: '800' },
    roleTagTextCoach: { color: '#fff' },
    ratingTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ratingText: { color: C.textPrimary, fontSize: 13, fontWeight: '800' },

    // Sheets
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.cardBackground,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: 20,
      paddingBottom: 34,
      borderWidth: 1,
      borderColor: C.border,
    },
    sheetHandle: {
      width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
      alignSelf: 'center', marginBottom: 14,
    },
    sheetTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    sheetName: { color: C.textPrimary, fontSize: 20, fontWeight: '900' },
    sheetSub: { color: C.textSecondary, fontSize: 13, marginTop: 3 },
    sheetLabel: { color: C.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginTop: 8, marginBottom: 8, textTransform: 'uppercase' },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    actChip: {
      backgroundColor: C.cardBackgroundLight,
      borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
      borderWidth: 1, borderColor: C.border,
    },
    actChipText: { color: C.textPrimary, fontSize: 13, fontWeight: '600' },

    sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    actBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 14, borderRadius: 12,
    },
    actBtnPrimary: { backgroundColor: C.primary },
    actBtnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
    actBtnDanger: { borderWidth: 1.5, borderColor: C.danger, backgroundColor: 'transparent' },
    actBtnTextDanger: { color: C.danger, fontSize: 15, fontWeight: '800' },
    actBtnMuted: { backgroundColor: C.cardBackgroundLight },
    actBtnTextMuted: { color: C.textMuted, fontSize: 15, fontWeight: '800' },

    offerBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 14, borderRadius: 12, marginTop: 12,
      borderWidth: 1.5, borderColor: C.primary, backgroundColor: C.cardBackgroundLight,
    },
    offerBtnText: { color: C.primary, fontSize: 14, fontWeight: '800' },

    // Gym sheet
    gymIconLg: {
      width: 72, height: 72, borderRadius: 16,
      backgroundColor: C.cardBackgroundLight, alignItems: 'center', justifyContent: 'center',
    },
    gymMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 12 },
    gymMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    gymMetaText: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
    gymDesc: { color: C.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 8 },
    coachRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    msgChip: {
      width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    addChip: {
      width: 38, height: 38, borderRadius: 19,
      borderWidth: 1.5, borderColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
    },
  });
  s._muted = C.textMuted;
  s._danger = C.danger;
  return s;
};

export default ConnectScreen;
