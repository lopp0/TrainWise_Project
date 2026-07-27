import React, { useCallback, useState } from 'react';
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
import {
  getEventsForUser,
  createEvent,
  rsvpEvent,
  deleteEvent,
  getEventAttendees,
} from '../services/api';
import ThemedDateTimePicker from '../components/ThemedDateTimePicker';
import Avatar from '../components/Avatar';
import { parseServerDate } from '../utils/serverDate';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenTutorial from '../components/ScreenTutorial';
import { isTutorialDone, markTutorialDone } from '../utils/tutorialManager';

/**
 * #145 — Group runs / events. Create an event (time + place), your friends see
 * it, everyone RSVPs going / maybe / no. The creator can delete it.
 */
const RSVP_OPTS = [
  ['going', 'Going', 'checkmark-circle'],
  ['maybe', 'Maybe', 'help-circle'],
  ['no', 'No', 'close-circle'],
];
const rsvpColor = (s, C) => (s === 'going' ? C.success : s === 'maybe' ? C.warning : C.textMuted);

const fmtWhen = (d) => {
  if (!d) return '';
  const date = parseServerDate(d);
  return date.toLocaleString('en-US', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
  });
};

// First-visit walkthrough for the Events screen (shown once, tracked by
// tutorialManager under the 'events' key).
const EVENTS_TUTORIAL_STEPS = [
  {
    icon: '📅',
    title: 'Plan a Group Event',
    body: 'Tap + to create a group run or session. Set a title, time, and optionally a meeting place and details.',
  },
  {
    icon: '✅',
    title: 'RSVP',
    body: 'Friends see your event and respond Going, Maybe, or No — tap "X going" to see who is coming.',
  },
  {
    icon: '💬',
    title: 'Group Chat',
    body: "Anyone who's Going or Maybe (plus the organizer) gets a group chat to coordinate the details.",
  },
];

const EventsScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [place, setPlace] = useState('');
  const [when, setWhen] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; });
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [attendeesOf, setAttendeesOf] = useState(null);
  const [attendees, setAttendees] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEventsForUser(userId);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  React.useEffect(() => {
    isTutorialDone('events')
      .then((done) => { if (!done) setShowTutorial(true); })
      .catch((e) => console.warn('[EventsScreen] tutorial check failed:', e.message));
  }, []);

  const handleTutorialFinish = async () => {
    await markTutorialDone('events');
    setShowTutorial(false);
  };

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('Name the event', 'Give the event a short title.');
      return;
    }
    setSaving(true);
    try {
      await createEvent({
        creatorID: userId,
        title: title.trim(),
        description: desc.trim() || null,
        eventTime: when.toISOString(),
        locationName: place.trim() || null,
      });
      setShowCreate(false);
      setTitle(''); setDesc(''); setPlace('');
      load();
    } catch (e) {
      Alert.alert('Could not create', e?.response?.data?.toString?.() || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const doRsvp = async (ev, status) => {
    const id = ev.eventID ?? ev.EventID;
    // optimistic
    setItems((prev) => prev.map((x) =>
      (x.eventID ?? x.EventID) === id ? { ...x, myStatus: status, MyStatus: status } : x));
    try { await rsvpEvent(id, userId, status); } catch {}
    load();
  };

  const confirmDelete = (ev) => {
    Alert.alert('Delete event', `Delete "${ev.title ?? ev.Title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteEvent(ev.eventID ?? ev.EventID, userId); } catch {}
          load();
        },
      },
    ]);
  };

  const openAttendees = async (ev) => {
    setAttendeesOf(ev);
    setAttendees([]);
    try {
      const res = await getEventAttendees(ev.eventID ?? ev.EventID);
      setAttendees(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAttendees([]);
    }
  };

  const renderCard = ({ item }) => {
    const mine = (item.creatorID ?? item.CreatorID) === userId;
    const myStatus = item.myStatus ?? item.MyStatus;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title ?? item.Title}</Text>
          {mine && (
            <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{fmtWhen(item.eventTime ?? item.EventTime)}</Text>
        </View>
        {(item.locationName ?? item.LocationName) ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{item.locationName ?? item.LocationName}</Text>
          </View>
        ) : null}
        {(item.description ?? item.Description) ? (
          <Text style={styles.desc}>{item.description ?? item.Description}</Text>
        ) : null}
        <TouchableOpacity onPress={() => openAttendees(item)}>
          <Text style={styles.goingLink}>
            {item.goingCount ?? item.GoingCount} going · by {item.creatorName ?? item.CreatorName}
          </Text>
        </TouchableOpacity>

        <View style={styles.rsvpRow}>
          {RSVP_OPTS.map(([key, label, icon]) => {
            const on = myStatus === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.rsvpBtn, on && { backgroundColor: rsvpColor(key, Colors), borderColor: rsvpColor(key, Colors) }]}
                onPress={() => doRsvp(item, key)}
              >
                <Ionicons name={icon} size={15} color={on ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.rsvpText, on && { color: '#fff' }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* #145 — group chat, for the creator + anyone going/maybe. */}
        {(mine || myStatus === 'going' || myStatus === 'maybe') && (
          <TouchableOpacity
            style={styles.chatBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('EventChat', {
              eventId: item.eventID ?? item.EventID,
              eventTitle: item.title ?? item.Title,
            })}
          >
            <Ionicons name="chatbubbles-outline" size={16} color={Colors.primary} />
            <Text style={styles.chatBtnText}>Group chat</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Group events</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} hitSlop={8}>
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e, i) => String(e.eventID ?? e.EventID ?? i)}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.empty}>No upcoming events. Tap + to plan a group run or session.</Text>
            </View>
          }
        />
      )}

      {/* Create modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New event</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle}
                placeholder="e.g. Saturday long run" placeholderTextColor={Colors.textMuted} maxLength={120} />

              <Text style={styles.label}>When</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
                <Ionicons name="time-outline" size={18} color={Colors.primary} />
                <Text style={styles.dateText}>{fmtWhen(when)}</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Where (optional)</Text>
              <TextInput style={styles.input} value={place} onChangeText={setPlace}
                placeholder="e.g. Netanya beach promenade" placeholderTextColor={Colors.textMuted} maxLength={200} />

              <Text style={styles.label}>Details (optional)</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc}
                placeholder="Pace, distance, meeting point…" placeholderTextColor={Colors.textMuted} multiline maxLength={600} />
            </ScrollView>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setShowCreate(false)}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ThemedDateTimePicker
        visible={showPicker}
        value={when}
        onCancel={() => setShowPicker(false)}
        onConfirm={(d) => { setWhen(d); setShowPicker(false); }}
      />

      {/* Attendees modal */}
      <Modal visible={!!attendeesOf} transparent animationType="fade" onRequestClose={() => setAttendeesOf(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.standHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{attendeesOf?.title ?? attendeesOf?.Title}</Text>
              <TouchableOpacity onPress={() => setAttendeesOf(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {attendees.length === 0 ? (
                <Text style={styles.empty}>No RSVPs yet.</Text>
              ) : attendees.map((a, i) => (
                <View key={a.userID ?? a.UserID ?? i} style={styles.attRow}>
                  <Avatar user={{ fullName: a.fullName ?? a.FullName, profileImagePath: a.profileImagePath ?? a.ProfileImagePath }} size={34} />
                  <Text style={styles.attName} numberOfLines={1}>{a.fullName ?? a.FullName}</Text>
                  <Text style={[styles.attStatus, { color: rsvpColor(a.status ?? a.Status, Colors) }]}>
                    {a.status ?? a.Status}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScreenTutorial
        visible={showTutorial}
        steps={EVENTS_TUTORIAL_STEPS}
        onFinish={handleTutorialFinish}
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
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: C.cardBackground, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '800', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  metaText: { color: C.textSecondary, fontSize: 13 },
  desc: { color: C.textSecondary, fontSize: 13, marginTop: 8, lineHeight: 18 },
  goingLink: { color: C.primary, fontSize: 12, fontWeight: '700', marginTop: 10 },
  rsvpRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rsvpBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.background,
  },
  rsvpText: { color: C.textSecondary, fontSize: 12, fontWeight: '800' },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.primary, backgroundColor: C.primary + '12',
  },
  chatBtnText: { color: C.primary, fontSize: 13, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40, gap: 10 },
  empty: { color: C.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 20 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 18 },
  modalCard: { backgroundColor: C.cardBackground, borderRadius: 16, padding: 18, maxHeight: '86%' },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '900', marginBottom: 6 },
  label: { color: C.textSecondary, fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: C.inputBackground, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: C.textPrimary, fontSize: 15, borderWidth: 1, borderColor: C.inputBorder,
  },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.inputBackground,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: C.inputBorder,
  },
  dateText: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnGhost: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  btnGhostText: { color: C.textSecondary, fontSize: 15, fontWeight: '800' },
  btnPrimary: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  standHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  attName: { color: C.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  attStatus: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
});

export default EventsScreen;