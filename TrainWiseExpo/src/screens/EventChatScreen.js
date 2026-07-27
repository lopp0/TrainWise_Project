import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  createAudioPlayer,
} from 'expo-audio';
import { useAuth } from '../api/AuthContext';
import {
  getEventMessages,
  postEventMessage,
  reactToEventMessage,
  getEventReactions,
  getProgramMessages,
  postProgramMessage,
  reactToProgramMessage,
  getProgramReactions,
  uploadChatImage,
  uploadChatAudio,
  uploadChatVideo,
  resolveProfileImageUrl,
} from '../services/api';
import Avatar from '../components/Avatar';
import ZoomableImage from '../components/ZoomableImage';
import VideoPlayerModal from '../components/VideoPlayerModal';
import { parseServerDate } from '../utils/serverDate';
import { renderTextWithLinks, LINK_BLUE, LINK_BLUE_ON_ACCENT } from '../utils/linkify';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import ScreenTutorial from '../components/ScreenTutorial';
import { isTutorialDone, markTutorialDone } from '../utils/tutorialManager';

/**
 * #145 — Group chat for an event. Attendees (creator + going/maybe RSVPs)
 * discuss time / place / details.
 *
 * #7 (2026-07-19) — full parity with the 1:1 ChatScreen: photos, form-check
 * videos, voice notes, pinch-to-zoom image viewer, long-press emoji reactions,
 * tappable blue links and read receipts ("seen by N"). Media re-uses the SAME
 * generic upload endpoints as the 1:1 chat, so there is nothing extra server-side
 * for uploads. Requires sql/2026-07-19_event_chat_full.sql.
 */
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '💪', '👏'];

/**
 * This screen powers TWO group-chat channels with the SAME UI: an event group
 * chat (#145) and a per-program coach↔trainee thread (#133). The channel is
 * chosen by `route.params.kind` ('event' default, so existing navigations that
 * pass eventId/eventTitle keep working). Each channel just plugs in its four
 * data-access functions, which share an identical signature.
 */
const CHANNELS = {
  event: {
    getMessages: getEventMessages,
    postMessage: postEventMessage,
    react: reactToEventMessage,
    getReactions: getEventReactions,
    subtitle: 'Group chat',
    placeholder: 'Message the group…',
    emptyHint: 'No messages yet. Say hi, agree on a time, or drop a Google Maps / Waze link 📍',
  },
  program: {
    getMessages: getProgramMessages,
    postMessage: postProgramMessage,
    react: reactToProgramMessage,
    getReactions: getProgramReactions,
    subtitle: 'Program chat',
    placeholder: 'Message…',
    emptyHint: 'No messages yet. Discuss this training program here.',
  },
};

// Dual-cased accessors (the API serializes camelCase but stay tolerant).
const mId = (m) => m.messageId ?? m.MessageId;
const mSender = (m) => m.senderId ?? m.SenderId;
const mText = (m) => m.text ?? m.Text ?? '';
const mImage = (m) => m.imagePath ?? m.ImagePath ?? null;
const mVideo = (m) => m.videoPath ?? m.VideoPath ?? null;
const mAudio = (m) => m.audioPath ?? m.AudioPath ?? null;
const mSeenCount = (m) => m.seenCount ?? m.SeenCount ?? 0;

const fmtTime = (d) =>
  parseServerDate(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });

const errText = (e) => {
  const d = e?.response?.data;
  if (typeof d === 'string' && d) return d;
  if (d?.title) return d.title;
  return e?.message || 'Please try again.';
};
// First-visit walkthrough for the Event/Program chat screen (shown once,
// tracked by tutorialManager under the 'eventChat' key).
const EVENT_CHAT_TUTORIAL_STEPS = [
  {
    icon: '💬',
    title: 'Chat With the Group',
    body: 'Send text, photos, or videos to everyone in this event or program thread.',
  },
  {
    icon: '🎙️',
    title: 'Voice Messages',
    body: 'No text field? Tap the mic to record and send a voice message with one tap.',
  },
  {
    icon: '😀',
    title: 'React to Messages',
    body: 'Long-press any message to add an emoji reaction.',
  },
  {
    icon: '✓✓',
    title: 'Read Receipts',
    body: 'The double checkmark and number under your messages show how many people have seen them.',
  },
];
const EventChatScreen = ({ navigation, route }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);
  // Channel: 'event' (default, back-compat with eventId/eventTitle) or 'program'.
  const kind = route?.params?.kind || 'event';
  const chan = CHANNELS[kind] || CHANNELS.event;
  const channelId = route?.params?.channelId ?? route?.params?.eventId;
  const chatTitle = route?.params?.title || route?.params?.eventTitle || 'Chat';

  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState({}); // messageId -> [emoji]
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const [viewerUri, setViewerUri] = useState(null);   // full-screen image
  const [videoUri, setVideoUri] = useState(null);     // in-app video player
  const [reactTarget, setReactTarget] = useState(null);
  const [recording, setRecording] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [playProgress, setPlayProgress] = useState(0);

  const listRef = useRef(null);
  const mountedRef = useRef(true);
  const playerRef = useRef(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Release playback / recording resources on unmount.
      try { playerRef.current?.remove(); } catch {}
      playerRef.current = null;
      try { audioRecorder.stop(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    isTutorialDone('eventChat')
      .then((done) => { if (!done) setShowTutorial(true); })
      .catch((e) => console.warn('[EventChatScreen] tutorial check failed:', e.message));
  }, []);

  const handleTutorialFinish = async () => {
    await markTutorialDone('eventChat');
    setShowTutorial(false);
  };
  const load = useCallback(async () => {
    if (!channelId) return;
    try {
      const [msgRes, rxRes] = await Promise.all([
        chan.getMessages(channelId, userId),
        chan.getReactions(channelId, userId).catch(() => ({ data: [] })),
      ]);
      if (!mountedRef.current) return;
      setMessages(Array.isArray(msgRes.data) ? msgRes.data : []);
      // Group reactions by message id for the chips under each bubble.
      const map = {};
      (Array.isArray(rxRes.data) ? rxRes.data : []).forEach((r) => {
        const id = r.messageId ?? r.MessageId;
        const emoji = r.emoji ?? r.Emoji;
        if (!map[id]) map[id] = [];
        map[id].push(emoji);
      });
      setReactions(map);
      setError(null);
    } catch (e) {
      if (mountedRef.current) setError(errText(e) || 'Could not load the chat.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [channelId, userId, chan]);

  // Focus-gated 5s poll (cheap; only while the screen is open).
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
      const id = setInterval(load, 5000);
      return () => clearInterval(id);
    }, [load])
  );

  const scrollToEnd = (animated = true) =>
    setTimeout(() => listRef.current?.scrollToEnd({ animated }), 50);

  // One place to post + append, whatever the payload is.
  const post = async (payload, failTitle) => {
    try {
      setSending(true);
      const res = await chan.postMessage(channelId, userId, payload);
      const saved = res.data;
      if (mountedRef.current && saved) {
        setMessages((prev) => [...prev, saved]);
        scrollToEnd(true);
      }
    } catch (e) {
      if (mountedRef.current) Alert.alert(failTitle, errText(e));
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setText('');
    await post({ text: t }, 'Message not sent');
  };

  const handlePickImage = async () => {
    if (sending || recording) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access to send images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (result.canceled || !result.assets?.length) return;
      setSending(true);
      const up = await uploadChatImage(result.assets[0].uri);
      setSending(false);
      await post({ imagePath: up.path }, 'Photo not sent');
    } catch (e) {
      if (mountedRef.current) { setSending(false); Alert.alert('Photo not sent', errText(e)); }
    }
  };

  const handlePickVideo = async () => {
    if (sending || recording) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow media access to send a video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.6,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets?.length) return;

      // Reject oversize clips up front with a friendly message instead of a raw
      // 400 "request body too large" (same as the 1:1 chat).
      const asset = result.assets[0];
      const MAX_VIDEO_MB = 100;
      if (asset.fileSize && asset.fileSize > MAX_VIDEO_MB * 1024 * 1024) {
        const mb = Math.round(asset.fileSize / (1024 * 1024));
        Alert.alert('Video too large', `This clip is ${mb} MB. Please send a video under ${MAX_VIDEO_MB} MB — trim it or record a shorter clip.`);
        return;
      }

      setSending(true);
      const up = await uploadChatVideo(asset.uri);
      setSending(false);
      await post({ videoPath: up.path }, 'Video not sent');
    } catch (e) {
      if (mountedRef.current) {
        setSending(false);
        const raw = errText(e);
        const friendly = /too large|body size|413/i.test(raw)
          ? 'That video is too large to send (max 100 MB). Please trim it or record a shorter clip.'
          : raw;
        Alert.alert('Video not sent', friendly);
      }
    }
  };

  // ── voice notes ──────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (sending || recording) return;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow microphone access to record a voice message.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      if (mountedRef.current) setRecording(true);
    } catch (e) {
      Alert.alert('Cannot record', errText(e));
    }
  };

  const finishRecording = async () => {
    try { await audioRecorder.stop(); } catch {}
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    return audioRecorder.uri;
  };

  const stopAndSendRecording = async () => {
    if (!recording) return;
    setRecording(false);
    const uri = await finishRecording();
    if (!uri) return;
    try {
      setSending(true);
      const up = await uploadChatAudio(uri);
      setSending(false);
      await post({ audioPath: up.path }, 'Voice message not sent');
    } catch (e) {
      if (mountedRef.current) { setSending(false); Alert.alert('Voice message not sent', errText(e)); }
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    setRecording(false);
    await finishRecording();
  };

  const stopPlayback = () => {
    try { playerRef.current?.remove(); } catch {}
    playerRef.current = null;
  };

  const togglePlay = (id, url) => {
    if (playingId === id) { // tapping the playing one stops it
      stopPlayback();
      setPlayingId(null);
      setPlayProgress(0);
      return;
    }
    stopPlayback();
    setPlayProgress(0);
    try {
      const player = createAudioPlayer({ uri: url });
      playerRef.current = player;
      player.addListener('playbackStatusUpdate', (status) => {
        if (!mountedRef.current) return;
        const dur = Number(status?.duration) || 0;
        const cur = Number(status?.currentTime) || 0;
        if (dur > 0) setPlayProgress(Math.max(0, Math.min(1, cur / dur)));
        if (status?.didJustFinish) {
          stopPlayback();
          setPlayingId(null);
          setPlayProgress(0);
        }
      });
      player.play();
      setPlayingId(id);
    } catch {
      setPlayingId(null);
      setPlayProgress(0);
    }
  };

  // Deterministic pseudo-waveform so bars stay stable across re-renders.
  const waveHeights = (id) => {
    const bars = [];
    let seed = (Number(id) || 7) * 9301 + 49297;
    for (let i = 0; i < 22; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      bars.push(6 + (seed / 233280) * 16);
    }
    return bars;
  };

  const applyReaction = async (emoji) => {
    const messageId = reactTarget;
    setReactTarget(null);
    if (!messageId) return;
    try {
      await chan.react(channelId, messageId, userId, emoji);
      load();
    } catch (e) {
      Alert.alert('Could not react', errText(e));
    }
  };

  const renderMsg = ({ item }) => {
    const mine = mSender(item) === userId;
    const id = mId(item);
    const text = mText(item);
    const img = mImage(item);
    const imgUrl = img ? resolveProfileImageUrl(img) : null;
    const video = mVideo(item);
    const videoUrl = video ? resolveProfileImageUrl(video) : null;
    const audio = mAudio(item);
    const audioUrl = audio ? resolveProfileImageUrl(audio) : null;
    const msgReactions = reactions[id] || [];
    const seenCount = mSeenCount(item);

    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheir]}>
        {!mine && (
          <Avatar
            user={{
              fullName: item.senderName ?? item.SenderName,
              profileImagePath: item.senderImage ?? item.SenderImage,
            }}
            size={30}
          />
        )}
        <View style={{ maxWidth: '78%' }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => setReactTarget(id)}
            delayLongPress={250}
            style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheir]}
          >
            {!mine && <Text style={styles.sender}>{item.senderName ?? item.SenderName}</Text>}

            {imgUrl && (
              <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerUri(imgUrl)}>
                <Image source={{ uri: imgUrl }} style={styles.chatImage} resizeMode="cover" />
              </TouchableOpacity>
            )}

            {videoUrl && (
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.videoWrap}
                onPress={() => setVideoUri(videoUrl)}
              >
                <View style={styles.videoPlayBadge}>
                  <Ionicons name="play" size={26} color="#fff" />
                </View>
                <Text style={[styles.videoLabel, mine && { color: 'rgba(255,255,255,0.9)' }]}>
                  Video · tap to play
                </Text>
              </TouchableOpacity>
            )}

            {audioUrl && (() => {
              const isPlaying = playingId === id;
              const bars = waveHeights(id);
              const progress = isPlaying ? playProgress : 0;
              const played = mine ? '#FFFFFF' : Colors.primary;
              const unplayed = mine ? 'rgba(255,255,255,0.4)' : Colors.textMuted;
              return (
                <TouchableOpacity
                  style={styles.audioRow}
                  onPress={() => togglePlay(id, audioUrl)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={20}
                    color={mine ? '#fff' : Colors.primary}
                  />
                  <View style={styles.waveRow}>
                    {bars.map((h, i) => (
                      <View
                        key={i}
                        style={[
                          styles.waveBar,
                          { height: h, backgroundColor: i / bars.length <= progress ? played : unplayed },
                        ]}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })()}

            {!!text && (
              <Text style={[styles.msgText, mine && styles.msgTextMine, (imgUrl || videoUrl) && { marginTop: 6 }]}>
                {renderTextWithLinks(text, mine ? styles.linkMine : styles.link)}
              </Text>
            )}

            <View style={styles.metaRow}>
              <Text style={[styles.time, mine && styles.timeMine]}>
                {fmtTime(item.createdAt ?? item.CreatedAt)}
              </Text>
              {/* Read receipts: in a group "seen" is a count of other attendees. */}
              {mine && (
                <>
                  <Ionicons
                    name={seenCount > 0 ? 'checkmark-done' : 'checkmark'}
                    size={14}
                    color={seenCount > 0 ? '#4FC3F7' : 'rgba(255,255,255,0.7)'}
                    style={{ marginLeft: 3 }}
                  />
                  {seenCount > 0 && <Text style={styles.seenCount}>{seenCount}</Text>}
                </>
              )}
            </View>
          </TouchableOpacity>

          {msgReactions.length > 0 && (
            <View style={[styles.reactionRow, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
              {msgReactions.map((e, i) => (
                <Text key={i} style={styles.reactionChip}>{e}</Text>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>{chatTitle}</Text>
          <Text style={styles.subtitle}>{chan.subtitle}</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {/* 'padding' on BOTH platforms. Previously undefined on Android relying on
          windowSoftInputMode="adjustResize", but edge-to-edge (edgeToEdgeEnabled:
          true) stops the window resizing for the keyboard, leaving the composer
          hidden underneath. Padding lifts it. (Do NOT use 'height' — it double-
          shrinks and leaves a stale offset, device-test 2026-07-19.) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m, i) => String(mId(m) ?? i)}
            renderItem={renderMsg}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {error || chan.emptyHint}
              </Text>
            }
          />
        )}

        {/* Composer. While recording it swaps to a discard / send bar. */}
        {recording ? (
          <View style={styles.composer}>
            <TouchableOpacity style={styles.iconBtn} onPress={cancelRecording} hitSlop={8}>
              <Ionicons name="trash" size={24} color={Colors.danger} />
            </TouchableOpacity>
            <View style={styles.recordingWrap}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>Recording… tap send to finish</Text>
            </View>
            <TouchableOpacity style={styles.sendBtn} onPress={stopAndSendRecording} activeOpacity={0.85}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.composer}>
            <TouchableOpacity style={styles.iconBtn} onPress={handlePickImage} disabled={sending} hitSlop={8}>
              <Ionicons name="image" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handlePickVideo} disabled={sending} hitSlop={8}>
              <Ionicons name="videocam" size={23} color={Colors.primary} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={chan.placeholder}
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={1000}
            />
            {/* Mic replaces send when nothing is typed (WhatsApp-style). */}
            {text.trim() ? (
              <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending} activeOpacity={0.85}>
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.sendBtn} onPress={startRecording} disabled={sending} activeOpacity={0.85}>
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="mic" size={20} color="#fff" />}
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Full-screen pinch-to-zoom image viewer */}
      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={styles.viewerBackdrop}>
          {!!viewerUri && (
            <View style={styles.viewerImage}>
              <ZoomableImage uri={viewerUri} />
            </View>
          )}
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* In-app video player */}
      {videoUri && <VideoPlayerModal uri={videoUri} onClose={() => setVideoUri(null)} />}

      {/* Emoji reaction picker (long-press a bubble) */}
      <Modal visible={reactTarget != null} transparent animationType="fade" onRequestClose={() => setReactTarget(null)}>
        <TouchableOpacity style={styles.reactBackdrop} activeOpacity={1} onPress={() => setReactTarget(null)}>
          <View style={styles.reactPicker}>
            {REACTION_EMOJIS.map((e) => (
              <TouchableOpacity key={e} onPress={() => applyReaction(e)} style={styles.reactPick}>
                <Text style={styles.reactPickEmoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      
</Modal>

<ScreenTutorial
        visible={showTutorial}
        steps={EVENT_CHAT_TUTORIAL_STEPS}
        onFinish={handleTutorialFinish}
      />
    </SafeAreaView>
  );
};

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
  subtitle: { color: C.textMuted, fontSize: 11 },
  listContent: { padding: 14, paddingBottom: 20, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheir: { justifyContent: 'flex-start' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  bubbleTheir: { backgroundColor: C.cardBackground, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  sender: { color: C.primary, fontSize: 11, fontWeight: '800', marginBottom: 2 },
  msgText: { color: C.textPrimary, fontSize: 14, lineHeight: 19 },
  msgTextMine: { color: '#fff' },
  link: { color: LINK_BLUE, textDecorationLine: 'underline' },
  linkMine: { color: LINK_BLUE_ON_ACCENT, textDecorationLine: 'underline' },

  chatImage: { width: 210, height: 210, borderRadius: 12, marginBottom: 2 },
  videoWrap: { width: 210, height: 118, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  videoPlayBadge: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoLabel: { color: C.textSecondary, fontSize: 11, marginTop: 6 },

  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2, minWidth: 190 },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  waveBar: { width: 3, borderRadius: 2 },

  metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 3 },
  time: { color: C.textMuted, fontSize: 9 },
  timeMine: { color: 'rgba(255,255,255,0.75)' },
  seenCount: { color: '#4FC3F7', fontSize: 9, fontWeight: '800', marginLeft: 2 },

  reactionRow: { flexDirection: 'row', gap: 3, marginTop: 2, paddingHorizontal: 4 },
  reactionChip: { fontSize: 13 },

  empty: { color: C.textMuted, textAlign: 'center', marginTop: 50, fontSize: 14, paddingHorizontal: 30, lineHeight: 20 },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  iconBtn: { paddingBottom: 8 },
  input: {
    flex: 1, backgroundColor: C.inputBackground, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    color: C.textPrimary, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: C.inputBorder,
  },
  sendBtn: { backgroundColor: C.primary, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  recordingWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.danger },
  recText: { color: C.textSecondary, fontSize: 13 },

  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 44, right: 20, padding: 6 },

  reactBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  reactPicker: {
    flexDirection: 'row', gap: 6, backgroundColor: C.cardBackground, borderRadius: 30,
    paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.border,
  },
  reactPick: { paddingHorizontal: 6, paddingVertical: 2 },
  reactPickEmoji: { fontSize: 26 },
});

export default EventChatScreen;
