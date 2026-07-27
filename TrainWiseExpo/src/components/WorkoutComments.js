import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/useThemedStyles';
import Avatar from './Avatar';
import { getWorkoutComments, addWorkoutComment, deleteWorkoutComment } from '../services/api';
import { parseServerDate } from '../utils/serverDate';

/**
 * #134 — Coach comments on a workout. Shows the comment thread for one log; the
 * athlete (owner) or any of their coaches can post. The trainee sees a coach's
 * feedback here when they open their own workout summary.
 *
 * props: { logId, viewerId, canComment }
 */
const WorkoutComments = ({ logId, viewerId, canComment = false }) => {
  const styles = useThemedStyles(makeStyles);
  const C = styles._colors;
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!logId) { setLoading(false); return; }
    try {
      const res = await getWorkoutComments(logId);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [logId]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      await addWorkoutComment(logId, viewerId, t);
      setText('');
      load();
    } catch (e) {
      Alert.alert('Could not post', e?.response?.data?.toString?.() || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const remove = (c) => {
    Alert.alert('Delete comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteWorkoutComment(c.commentId ?? c.CommentId, viewerId); } catch {}
          load();
        },
      },
    ]);
  };

  if (!logId) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="chatbubbles-outline" size={16} color={C.primary} />
        <Text style={styles.header}>COACH FEEDBACK</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />
      ) : comments.length === 0 ? (
        <Text style={styles.empty}>No comments yet.{canComment ? ' Be the first to add feedback.' : ''}</Text>
      ) : (
        comments.map((c) => {
          const mine = (c.authorUserID ?? c.AuthorUserID) === viewerId;
          const isCoach = c.isCoach ?? c.IsCoach;
          return (
            <View key={c.commentId ?? c.CommentId} style={styles.commentRow}>
              <Avatar user={{ fullName: c.authorName ?? c.AuthorName, profileImagePath: c.authorImage ?? c.AuthorImage }} size={32} />
              <View style={{ flex: 1 }}>
                <View style={styles.commentTop}>
                  <Text style={styles.author} numberOfLines={1}>
                    {c.authorName ?? c.AuthorName}
                    {isCoach ? <Text style={styles.coachTag}>  · Coach</Text> : null}
                  </Text>
                  {mine && (
                    <TouchableOpacity onPress={() => remove(c)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={14} color={C.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.commentText}>{c.text ?? c.Text}</Text>
                <Text style={styles.commentTime}>
                  {parseServerDate(c.createdAt ?? c.CreatedAt).toLocaleString('en-US', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
                  })}
                </Text>
              </View>
            </View>
          );
        })
      )}

      {canComment && (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Add feedback…"
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={600}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending || !text.trim()}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    wrap: {
      backgroundColor: C.cardBackground, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: C.border, marginTop: 12,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    header: { color: C.primary, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
    empty: { color: C.textMuted, fontSize: 13, marginVertical: 6 },
    commentRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    commentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    author: { color: C.textPrimary, fontSize: 13, fontWeight: '800', flex: 1 },
    coachTag: { color: C.primary, fontSize: 11, fontWeight: '700' },
    commentText: { color: C.textSecondary, fontSize: 13, marginTop: 2, lineHeight: 18 },
    commentTime: { color: C.textMuted, fontSize: 10, marginTop: 3 },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
    input: {
      flex: 1, backgroundColor: C.inputBackground, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
      color: C.textPrimary, fontSize: 14, maxHeight: 90, borderWidth: 1, borderColor: C.inputBorder,
    },
    sendBtn: { backgroundColor: C.primary, borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  });
  s._colors = C;
  return s;
};

export default WorkoutComments;
