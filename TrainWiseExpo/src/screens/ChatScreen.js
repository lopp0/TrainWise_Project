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
import {
  getConversation,
  sendMessage,
  markMessagesSeen,
  resolveProfileImageUrl,
  getUserById,
  uploadChatImage,
} from '../services/api';
import { useMessages } from '../api/MessagesContext';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

const POLL_MS = 4000;

// Field accessors tolerant of camelCase (ASP.NET default) AND PascalCase,
// mirroring the dual-casing convention used across the app.
const mId = (m) => m.messageID ?? m.MessageID;
const mSender = (m) => m.senderID ?? m.SenderID;
const mText = (m) => m.text ?? m.Text ?? '';
const mSentAt = (m) => m.sentAt ?? m.SentAt;
const mSeen = (m) => m.isSeen ?? m.IsSeen ?? false;
const mImage = (m) => m.imagePath ?? m.ImagePath ?? null;

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
  // Peer avatar: prefer the path passed via params, otherwise resolve it from
  // the user record (coach-side trainee summaries don't carry the image path).
  const [peerImg, setPeerImg] = useState(peerImagePath || null);

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

  useEffect(() => () => { mountedRef.current = false; }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!selfId || !peerId) {
      Alert.alert('Cannot send', 'This conversation is missing a participant.');
      return;
    }
    setSending(true);
    setInput('');
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

  const renderItem = ({ item }) => {
    const mine = mSender(item) === selfId;
    const text = mText(item);
    const img = mImage(item);
    const imgUrl = img ? resolveProfileImageUrl(img) : null;
    return (
      <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
        <View
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            imgUrl && styles.bubbleWithImage,
          ]}
        >
          {imgUrl && (
            <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerUri(imgUrl)}>
              <Image source={{ uri: imgUrl }} style={styles.chatImage} resizeMode="cover" />
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
              {text}
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
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
          <Text style={styles.headerSub}>TrainWise chat</Text>
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
        <TextInput
          style={styles.input}
          placeholder="Message…"
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color={Colors.textPrimary} size="small" />
          ) : (
            <Ionicons name="send" size={20} color={Colors.textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Full-screen image viewer */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <TouchableOpacity
          style={styles.viewerBackdrop}
          activeOpacity={1}
          onPress={() => setViewerUri(null)}
        >
          {!!viewerUri && (
            <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
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
      maxWidth: '78%',
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
    msgText: { color: C.textPrimary, fontSize: 15, lineHeight: 20 },
    msgTextMine: { color: '#FFFFFF' },
    metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 3 },
    msgTime: { color: C.textMuted, fontSize: 10 },
    msgTimeMine: { color: 'rgba(255,255,255,0.75)' },

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
