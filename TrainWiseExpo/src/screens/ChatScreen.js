import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ZoomableImage from '../components/ZoomableImage';
import VideoPlayerModal from '../components/VideoPlayerModal';
import { renderTextWithLinks, LINK_BLUE, LINK_BLUE_ON_ACCENT } from '../utils/linkify';
import { dayLabel, startsNewDay } from '../utils/chatDate';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  createAudioPlayer,
} from 'expo-audio';
import {
  getConversation,
  sendMessage,
  markMessagesSeen,
  resolveProfileImageUrl,
  getUserById,
  uploadChatImage,
  uploadChatAudio,
  uploadChatVideo,
  setTyping,
  getTyping,
  reactToMessage,
  getThreadReactions,
} from '../services/api';
import { useMessages } from '../api/MessagesContext';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

const POLL_MS = 4000;
// #140 — the emoji set offered on long-press.
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '💪', '👏'];

// Field accessors tolerant of camelCase (ASP.NET default) AND PascalCase,
// mirroring the dual-casing convention used across the app.
const mId = (m) => m.messageID ?? m.MessageID;
const mSender = (m) => m.senderID ?? m.SenderID;
const mText = (m) => m.text ?? m.Text ?? '';
const mSentAt = (m) => m.sentAt ?? m.SentAt;
const mSeen = (m) => m.isSeen ?? m.IsSeen ?? false;
const mImage = (m) => m.imagePath ?? m.ImagePath ?? null;
const mAudio = (m) => m.audioPath ?? m.AudioPath ?? null; // #139
const mVideo = (m) => m.videoPath ?? m.VideoPath ?? null; // #135

// Server stores SentAt in UTC but serializes it without a 'Z' designator, so
// new Date() would read it as local. Append 'Z' when no zone is present, then
// render in the app's fixed display zone.
const toLocalTime = (raw) => {
  if (!raw) return '';
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Jerusalem',
    });
  } catch {
    return '';
  }
};

// Extract a readable message from an axios error whose body may be a string,
// a 500 message, or a 400 ValidationProblemDetails object (avoids "[object Object]").
const errText = (e) => {
  const d = e?.response?.data;
  if (typeof d === 'string' && d) return d;
  if (d?.errors) {
    const first = Object.values(d.errors)[0];
    if (Array.isArray(first) && first[0]) return first[0];
  }
  if (d?.title) return d.title;
  if (d?.message) return d.message;
  return e?.message || 'Something went wrong.';
};

const ChatScreen = ({ route, navigation }) => {
  const { selfId, peerId, peerName, peerImagePath } = route.params || {};
  const styles = useThemedStyles(makeStyles);
  const { refreshUnread } = useMessages();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [viewerUri, setViewerUri] = useState(null); // full-screen image viewer
  const [videoUri, setVideoUri] = useState(null); // #3 in-app video player
  const [peerTyping, setPeerTyping] = useState(false); // #138
  const [reactions, setReactions] = useState({}); // #140 — messageId -> [emoji]
  const [reactTarget, setReactTarget] = useState(null); // #140 — message being reacted to
  const [recording, setRecording] = useState(false); // #139 — voice-record in progress
  const [playingId, setPlayingId] = useState(null); // #139 — voice message currently playing
  const [playProgress, setPlayProgress] = useState(0); // #139 — 0..1 position of the playing clip
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY); // #139
  const playerRef = useRef(null); // #139 — active playback player
  // Peer avatar: prefer the path passed via params, otherwise resolve it from
  // the user record (coach-side trainee summaries don't carry the image path).
  const [peerImg, setPeerImg] = useState(peerImagePath || null);

  const typingSentRef = useRef(0);
  const typingTimerRef = useRef(null);
  const listRef = useRef(null);
  const mountedRef = useRef(true);
  const firstLoadRef = useRef(true);
  // Tracks the highest message id we've already auto-marked seen, so we only
  // PUT /seen when genuinely new incoming messages arrive.
  const lastSeenAckRef = useRef(0);

  const peerAvatar = peerImg ? resolveProfileImageUrl(peerImg) : null;
  const peerInitial = (peerName || '?').trim().charAt(0).toUpperCase();

  // Resolve the peer's profile image once if it wasn't passed in.
  useEffect(() => {
    let alive = true;
    if (!peerImg && peerId) {
      getUserById(peerId)
        .then((res) => {
          const path = res.data?.profileImagePath ?? res.data?.ProfileImagePath;
          if (alive && path) setPeerImg(path);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId]);

  const scrollToEnd = useCallback((animated) => {
    requestAnimationFrame(() => {
      if (mountedRef.current) listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!selfId || !peerId) return;
    try {
      const res = await getConversation(selfId, peerId);
      const rows = Array.isArray(res.data) ? res.data : [];
      if (!mountedRef.current) return;

      setMessages((prev) => {
        // Only re-render when something actually changed (new message or a
        // read-receipt flip) to avoid re-rendering the list every poll.
        const changed =
          prev.length !== rows.length ||
          rows.some((r, i) => mId(r) !== mId(prev[i]) || mSeen(r) !== mSeen(prev[i]));
        return changed ? rows : prev;
      });

      // If the peer sent us anything new and unseen, acknowledge it so they
      // get read receipts. Guard with lastSeenAckRef to avoid redundant calls.
      const maxIncoming = rows.reduce(
        (acc, r) => (mSender(r) === peerId && !mSeen(r) ? Math.max(acc, mId(r)) : acc),
        0
      );
      if (maxIncoming > lastSeenAckRef.current) {
        lastSeenAckRef.current = maxIncoming;
        markMessagesSeen(peerId, selfId)
          .then(() => refreshUnread())
          .catch(() => {});
      }

      // #138 — is the peer currently typing to me?
      getTyping(selfId, peerId)
        .then((r) => mountedRef.current && setPeerTyping(!!r.data?.typing))
        .catch(() => {});

      // #140 — thread reactions, grouped by message id.
      getThreadReactions(selfId, peerId)
        .then((r) => {
          if (!mountedRef.current) return;
          const map = {};
          (Array.isArray(r.data) ? r.data : []).forEach((x) => {
            const id = x.messageID ?? x.MessageID;
            const emoji = x.emoji ?? x.Emoji;
            if (!map[id]) map[id] = [];
            map[id].push(emoji);
          });
          setReactions(map);
        })
        .catch(() => {});
    } catch {
      // Transient network errors are expected; the next poll retries.
    } finally {
      if (mountedRef.current && firstLoadRef.current) {
        setLoading(false);
        firstLoadRef.current = false;
        scrollToEnd(false);
      }
    }
  }, [selfId, peerId, scrollToEnd, refreshUnread]);

  // Poll while the screen is focused; stop when it blurs.
  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      refresh();
      const id = setInterval(refresh, POLL_MS);
      return () => {
        mountedRef.current = false;
        clearInterval(id);
      };
    }, [refresh])
  );

  useEffect(() => () => {
    mountedRef.current = false;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    // #139 — release any active playback / recording resources on unmount.
    if (playerRef.current) {
      try { playerRef.current.remove(); } catch {}
      playerRef.current = null;
    }
  }, []);

  // #138 — ping "typing" (throttled) on input, and clear it after a pause.
  const onChangeInput = (t) => {
    setInput(t);
    if (!selfId || !peerId) return;
    const now = Date.now();
    if (now - typingSentRef.current > 2500) {
      typingSentRef.current = now;
      setTyping(selfId, peerId, true).catch(() => {});
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingSentRef.current = 0;
      setTyping(selfId, peerId, false).catch(() => {});
    }, 3000);
  };

  const clearTyping = () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingSentRef.current = 0;
    if (selfId && peerId) setTyping(selfId, peerId, false).catch(() => {});
  };

  // #140 — apply an emoji reaction to the long-pressed message.
  const applyReaction = async (emoji) => {
    const messageId = reactTarget;
    setReactTarget(null);
    if (!messageId) return;
    try {
      await reactToMessage(messageId, selfId, emoji);
      refresh();
    } catch {}
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!selfId || !peerId) {
      Alert.alert('Cannot send', 'This conversation is missing a participant.');
      return;
    }
    setSending(true);
    setInput('');
    clearTyping();
    try {
      const res = await sendMessage({ senderId: selfId, receiverId: peerId, text });
      const saved = res.data;
      if (mountedRef.current && saved) {
        setMessages((prev) => [...prev, saved]);
        scrollToEnd(true);
      }
    } catch (e) {
      // Restore the text so the user doesn't lose what they typed, and surface
      // why it failed instead of silently doing nothing.
      if (mountedRef.current) {
        setInput(text);
        Alert.alert('Message not sent', errText(e));
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  const handlePickImage = async () => {
    if (sending) return;
    if (!selfId || !peerId) {
      Alert.alert('Cannot send', 'This conversation is missing a participant.');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access to send images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
      });
      if (result.canceled || !result.assets?.length) return;

      setSending(true);
      const up = await uploadChatImage(result.assets[0].uri);
      const res = await sendMessage({ senderId: selfId, receiverId: peerId, imagePath: up.path });
      const saved = res.data;
      if (mountedRef.current && saved) {
        setMessages((prev) => [...prev, saved]);
        scrollToEnd(true);
      }
    } catch (e) {
      if (mountedRef.current) {
        Alert.alert('Image not sent', errText(e));
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  // #135 — attach a form-check video from the library, upload + send it.
  const handlePickVideo = async () => {
    if (sending || recording) return;
    if (!selfId || !peerId) {
      Alert.alert('Cannot send', 'This conversation is missing a participant.');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow media access to send a video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.7,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets?.length) return;

      // #135 — reject oversize clips up front with a friendly message instead of
      // letting the server return a raw 400 "request body too large".
      const asset = result.assets[0];
      const MAX_VIDEO_MB = 100;
      if (asset.fileSize && asset.fileSize > MAX_VIDEO_MB * 1024 * 1024) {
        const mb = Math.round(asset.fileSize / (1024 * 1024));
        Alert.alert(
          'Video too large',
          `This clip is ${mb} MB. Please send a video under ${MAX_VIDEO_MB} MB — trim it or record a shorter form-check.`
        );
        return;
      }

      setSending(true);
      const up = await uploadChatVideo(asset.uri);
      const res = await sendMessage({ senderId: selfId, receiverId: peerId, videoPath: up.path });
      const saved = res.data;
      if (mountedRef.current && saved) {
        setMessages((prev) => [...prev, saved]);
        scrollToEnd(true);
      }
    } catch (e) {
      if (mountedRef.current) {
        // Turn the server's raw "request body too large" 400 into a clean message.
        const raw = errText(e);
        const friendly = /too large|body size|413/i.test(raw)
          ? 'That video is too large to send (max 100 MB). Please trim it or record a shorter clip.'
          : raw;
        Alert.alert('Video not sent', friendly);
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  // #139 — voice recording. Tap the mic to start; tap send to stop+upload, or
  // trash to discard.
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
    try {
      await audioRecorder.stop();
    } catch {}
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
      const res = await sendMessage({ senderId: selfId, receiverId: peerId, audioPath: up.path });
      const saved = res.data;
      if (mountedRef.current && saved) {
        setMessages((prev) => [...prev, saved]);
        scrollToEnd(true);
      }
    } catch (e) {
      if (mountedRef.current) Alert.alert('Voice message not sent', errText(e));
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    setRecording(false);
    await finishRecording();
  };

  // #139 — play / stop a voice bubble. One player at a time.
  const stopPlayback = () => {
    if (playerRef.current) {
      try {
        playerRef.current.remove();
      } catch {}
      playerRef.current = null;
    }
  };

  const togglePlay = (id, url) => {
    // Tapping the one already playing stops it.
    if (playingId === id) {
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
        // #139 — advance the progress dot in time with the audio (WhatsApp-style).
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

  // #139 — deterministic pseudo-waveform heights per message so the bars are
  // stable across re-renders (WhatsApp shows a fixed waveform per clip).
  const waveHeights = (id) => {
    const bars = [];
    let seed = (Number(id) || 7) * 9301 + 49297;
    for (let i = 0; i < 22; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      bars.push(6 + (seed / 233280) * 16); // 6..22 px
    }
    return bars;
  };

  const renderItem = ({ item, index }) => {
    const mine = mSender(item) === selfId;
    const text = mText(item);
    const img = mImage(item);
    const imgUrl = img ? resolveProfileImageUrl(img) : null;
    const audio = mAudio(item);
    const audioUrl = audio ? resolveProfileImageUrl(audio) : null;
    const video = mVideo(item);
    const videoUrl = video ? resolveProfileImageUrl(video) : null;
    const msgReactions = reactions[mId(item)] || [];
    // WhatsApp-style day separator above the first message of each day.
    const prev = index > 0 ? messages[index - 1] : null;
    const showDay = startsNewDay(mSentAt(item), prev ? mSentAt(prev) : null);
    return (
      <>
      {showDay && (
        <View style={styles.dayChipRow}>
          <Text style={styles.dayChipText}>{dayLabel(mSentAt(item))}</Text>
        </View>
      )}
      <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
        <View style={{ maxWidth: '80%' }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => setReactTarget(mId(item))}
          delayLongPress={250}
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            (imgUrl || videoUrl) && styles.bubbleWithImage,
          ]}
        >
          {imgUrl && (
            <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerUri(imgUrl)}>
              <Image source={{ uri: imgUrl }} style={styles.chatImage} resizeMode="cover" />
            </TouchableOpacity>
          )}
          {/* #139 — voice message: WhatsApp-style waveform with a progress dot */}
          {audioUrl && (() => {
            const isPlaying = playingId === mId(item);
            const bars = waveHeights(mId(item));
            const progress = isPlaying ? playProgress : 0;
            const playedColor = mine ? '#FFFFFF' : Colors.primary;
            const unplayedColor = mine ? 'rgba(255,255,255,0.4)' : Colors.textMuted;
            return (
              <TouchableOpacity
                style={styles.voiceRow}
                activeOpacity={0.8}
                onPress={() => togglePlay(mId(item), audioUrl)}
              >
                <Ionicons
                  name={isPlaying ? 'pause-circle' : 'play-circle'}
                  size={36}
                  color={playedColor}
                />
                <View style={styles.voiceBars}>
                  {bars.map((h, i) => {
                    const barPos = i / bars.length;
                    const played = barPos <= progress;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.voiceBar,
                          { height: h, backgroundColor: played ? playedColor : unplayedColor },
                        ]}
                      />
                    );
                  })}
                  {/* the moving progress dot */}
                  <View
                    style={[
                      styles.voiceDot,
                      { left: `${progress * 100}%`, backgroundColor: playedColor },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })()}
          {/* #135 — form-check video: thumbnail card opens the clip in the player */}
          {videoUrl && (
            <TouchableOpacity
              style={styles.videoCard}
              activeOpacity={0.9}
              onPress={() => setVideoUri(videoUrl)}
            >
              <View style={styles.videoPlayBadge}>
                <Ionicons name="play" size={26} color="#fff" />
              </View>
              <Text style={styles.videoLabel}>Form-check video · tap to play</Text>
            </TouchableOpacity>
          )}
          {!!text && (
            <Text
              style={[
                styles.msgText,
                mine && styles.msgTextMine,
                imgUrl && { marginTop: 6, paddingHorizontal: 2 },
              ]}
            >
              {/* #12 — URLs render as tappable blue links here too, not just in
                  the event group chat. */}
              {renderTextWithLinks(text, mine ? styles.linkMine : styles.link)}
            </Text>
          )}
          <View style={[styles.metaRow, imgUrl && { paddingHorizontal: 4, paddingBottom: 2 }]}>
            <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>
              {toLocalTime(mSentAt(item))}
            </Text>
            {mine && (
              <Ionicons
                name={mSeen(item) ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={mSeen(item) ? '#4FC3F7' : 'rgba(255,255,255,0.7)'}
                style={{ marginLeft: 3 }}
              />
            )}
          </View>
        </TouchableOpacity>
        {/* #140 — reaction chips under the bubble */}
        {msgReactions.length > 0 && (
          <View style={[styles.reactionRow, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
            {msgReactions.map((e, i) => (
              <Text key={i} style={styles.reactionChip}>{e}</Text>
            ))}
          </View>
        )}
        </View>
      </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // 'padding' on BOTH platforms: with edge-to-edge (edgeToEdgeEnabled:true,
      // SDK 54 default) the window no longer resizes for the keyboard, so
      // behavior:undefined left the composer hidden under the keyboard. Padding
      // lifts it reliably.
      behavior="padding"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.primary} />
        </TouchableOpacity>
        {peerAvatar ? (
          <Image source={{ uri: peerAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{peerInitial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {peerName || 'Chat'}
          </Text>
          <Text style={[styles.headerSub, peerTyping && { color: Colors.primary }]}>
            {peerTyping ? 'typing…' : 'TrainWise chat'}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, i) => String(mId(item) ?? i)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => {
            if (!firstLoadRef.current) scrollToEnd(false);
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={54} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>Say hi 👋 to start the conversation.</Text>
            </View>
          }
        />
      )}

      {/* Composer */}
      {recording ? (
        // #139 — recording bar: discard (trash) or stop+send.
        <View style={styles.composer}>
          <TouchableOpacity style={styles.imageBtn} onPress={cancelRecording} activeOpacity={0.7}>
            <Ionicons name="trash" size={24} color={Colors.danger || '#f44336'} />
          </TouchableOpacity>
          <View style={styles.recordingBar}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>Recording voice message…</Text>
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            onPress={stopAndSendRecording}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color={Colors.textPrimary} size="small" />
            ) : (
              <Ionicons name="send" size={20} color={Colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.composer}>
          <TouchableOpacity
            style={styles.imageBtn}
            onPress={handlePickImage}
            disabled={sending}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="image" size={26} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.imageBtn}
            onPress={handlePickVideo}
            disabled={sending}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="videocam" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={onChangeInput}
            multiline
            maxLength={1000}
          />
          {/* When there's no typed text, the mic replaces send (WhatsApp-style). */}
          {input.trim() ? (
            <TouchableOpacity
              style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator color={Colors.textPrimary} size="small" />
              ) : (
                <Ionicons name="send" size={20} color={Colors.textPrimary} />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
              onPress={startRecording}
              disabled={sending}
              activeOpacity={0.85}
            >
              <Ionicons name="mic" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Full-screen image viewer */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
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

      {/* #3 — in-app video player (form-check clips) */}
      {videoUri && <VideoPlayerModal uri={videoUri} onClose={() => setVideoUri(null)} />}

      {/* #140 — emoji reaction picker (long-press a bubble) */}
      <Modal
        visible={reactTarget != null}
        transparent
        animationType="fade"
        onRequestClose={() => setReactTarget(null)}
      >
        <TouchableOpacity
          style={styles.reactBackdrop}
          activeOpacity={1}
          onPress={() => setReactTarget(null)}
        >
          <View style={styles.reactPicker}>
            {REACTION_EMOJIS.map((e) => (
              <TouchableOpacity key={e} onPress={() => applyReaction(e)} style={styles.reactPick}>
                <Text style={styles.reactPickEmoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (C) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 50,
      paddingBottom: 12,
      paddingHorizontal: 10,
      backgroundColor: C.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    backBtn: { padding: 2, marginRight: 2 },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    avatarFallback: {
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: { color: C.textPrimary, fontSize: 18, fontWeight: '800' },
    headerName: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
    headerSub: { color: C.textSecondary, fontSize: 11, marginTop: 1 },

    listContent: { padding: 12, paddingBottom: 16, flexGrow: 1 },

    bubbleRow: { flexDirection: 'row', marginBottom: 8 },
    rowMine: { justifyContent: 'flex-end' },
    rowTheirs: { justifyContent: 'flex-start' },
    bubble: {
      // Width is capped by the 80%-max wrapper View around it (#140 reactions);
      // no maxWidth here or the bubble would end up ~62% wide (double-capped).
      alignSelf: 'stretch',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    bubbleMine: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
    bubbleTheirs: {
      backgroundColor: C.cardBackgroundLight,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: C.border,
    },
    bubbleWithImage: { padding: 4 },
    chatImage: { width: 220, height: 220, borderRadius: 12 },

    // #139 voice bubble
    voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, minWidth: 180 },
    voiceBars: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 26, position: 'relative' },
    voiceBar: { width: 3, borderRadius: 2 },
    voiceDot: {
      position: 'absolute',
      top: '50%',
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: -5,
      marginLeft: -5,
    },

    // #135 form-check video card
    videoCard: {
      width: 220,
      height: 130,
      borderRadius: 12,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoPlayBadge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoLabel: { color: '#fff', fontSize: 11, marginTop: 8, opacity: 0.9 },

    // #139 recording bar
    recordingBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.inputBackground,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: C.inputBorder,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#f44336' },
    recText: { color: C.textSecondary, fontSize: 14 },
    msgText: { color: C.textPrimary, fontSize: 15, lineHeight: 20 },
    msgTextMine: { color: '#FFFFFF' },
    // #12 blue tappable links (two shades so they read on both bubble colours)
    link: { color: LINK_BLUE, textDecorationLine: 'underline' },
    linkMine: { color: LINK_BLUE_ON_ACCENT, textDecorationLine: 'underline' },
    metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 3 },
    msgTime: { color: C.textMuted, fontSize: 10 },
    msgTimeMine: { color: 'rgba(255,255,255,0.75)' },

    // #140 reactions
    reactionRow: {
      flexDirection: 'row',
      gap: 2,
      marginTop: -4,
      marginBottom: 2,
      backgroundColor: C.cardBackground,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    reactionChip: { fontSize: 13 },

    // WhatsApp-style day separator between message groups.
    dayChipRow: { alignItems: 'center', marginVertical: 10 },
    dayChipText: {
      color: C.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      backgroundColor: C.cardBackgroundLight,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      overflow: 'hidden',
    },
    reactBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactPicker: {
      flexDirection: 'row',
      backgroundColor: C.cardBackground,
      borderRadius: 30,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: C.border,
      gap: 6,
    },
    reactPick: { paddingHorizontal: 6, paddingVertical: 4 },
    reactPickEmoji: { fontSize: 30 },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    emptyTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 12 },
    emptyText: { color: C.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center' },

    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 10,
      paddingVertical: 8,
      paddingBottom: Platform.OS === 'ios' ? 24 : 10,
      backgroundColor: C.cardBackground,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      backgroundColor: C.inputBackground,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      color: C.textPrimary,
      borderWidth: 1,
      borderColor: C.inputBorder,
      fontSize: 15,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    sendBtnDisabled: { opacity: 0.5 },
    imageBtn: {
      width: 40,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },

    // Full-screen image viewer
    viewerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerImage: { width: '100%', height: '80%' },
    viewerClose: {
      position: 'absolute',
      top: 48,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default ChatScreen;
