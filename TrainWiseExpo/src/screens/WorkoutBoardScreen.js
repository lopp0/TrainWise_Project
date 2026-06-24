import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Switch,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../api/AuthContext';
import {
  getBoardFeed,
  createBoardPost,
  deleteBoardPost,
  toggleBoardLike,
  sendFriendRequest,
  getActivityLogsByUser,
  getAllActivityTypes,
  uploadChatImage,
  resolveProfileImageUrl,
} from '../services/api';
import { parseServerDate } from '../utils/serverDate';
import UserProfileCard from '../components/UserProfileCard';
import ConnectTabs from '../components/ConnectTabs';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

const METRICS = [
  ['', 'None'],
  ['distance_km', 'Distance'],
  ['duration_min', 'Duration'],
  ['load', 'Load'],
  ['calories', 'Calories'],
];

const metricPill = (type, value) => {
  if (value == null || value === '') return null;
  const v = Number(value);
  if (Number.isNaN(v)) return null;
  switch (type) {
    case 'distance_km': return `🏃 ${v.toFixed(1)} km`;
    case 'duration_min': return `⏱️ ${Math.round(v)} min`;
    case 'load': return `🔥 ${Math.round(v)} load`;
    case 'calories': return `⚡ ${Math.round(v)} kcal`;
    default: return null;
  }
};

const timeAgo = (date) => {
  const d = (Date.now() - date.getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

const WorkoutBoardScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create modal
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [metricType, setMetricType] = useState('');
  const [metricValue, setMetricValue] = useState('');
  const [imageUri, setImageUri] = useState(null); // local photo before upload (item 9)
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Workout chooser (item 5): pick which logged workout to share.
  const [chooserOpen, setChooserOpen] = useState(false);
  const [recentLogs, setRecentLogs] = useState([]);
  const [typesById, setTypesById] = useState({});

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await getBoardFeed(userId, { country: 'IL', page: 0, limit: 30 });
      setPosts(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      // keep last list
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

  const onLike = async (post) => {
    const pid = post.postId ?? post.PostId;
    // optimistic
    setPosts((prev) =>
      prev.map((p) => {
        const id = p.postId ?? p.PostId;
        if (id !== pid) return p;
        const liked = !(p.likedByMe ?? p.LikedByMe);
        const count = (p.likeCount ?? p.LikeCount ?? 0) + (liked ? 1 : -1);
        return { ...p, likedByMe: liked, likeCount: count };
      })
    );
    try {
      await toggleBoardLike(pid, userId);
    } catch {
      load(); // revert on failure
    }
  };

  const onAddFriend = async (post) => {
    try {
      await sendFriendRequest(userId, post.userID ?? post.UserID);
      Alert.alert('Request sent', 'Friend request sent.');
    } catch (e) {
      Alert.alert('Could not add', e?.response?.data || 'Try again.');
    }
  };

  const onDelete = (post) => {
    Alert.alert('Delete post?', 'This removes your post from the board.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBoardPost(post.postId ?? post.PostId, userId);
            load();
          } catch (e) {
            Alert.alert('Error', 'Could not delete.');
          }
        },
      },
    ]);
  };

  // Open the chooser: load the user's recent (confirmed) workouts to pick from.
  const openChooser = async () => {
    try {
      const [logsRes, typesRes] = await Promise.all([
        getActivityLogsByUser(userId),
        getAllActivityTypes(),
      ]);
      const logs = (Array.isArray(logsRes.data) ? logsRes.data : []).filter(
        (l) => (l.isConfirmed ?? l.IsConfirmed) !== false
      );
      if (!logs.length) {
        Alert.alert('No workouts', 'Log a workout first to share it.');
        return;
      }
      const sorted = [...logs].sort(
        (a, b) => parseServerDate(b.startTime ?? b.StartTime) - parseServerDate(a.startTime ?? a.StartTime)
      );
      const types = Array.isArray(typesRes.data) ? typesRes.data : [];
      const map = {};
      types.forEach((t) => {
        map[t.activityTypeID ?? t.ActivityTypeID] = t.typeName;
      });
      setTypesById(map);
      setRecentLogs(sorted.slice(0, 25));
      setChooserOpen(true);
    } catch {
      Alert.alert('Error', 'Could not load your workouts.');
    }
  };

  // Prefill the form from a chosen workout.
  const prefillFromLog = (log) => {
    const name = typesById[log.activityTypeID ?? log.ActivityTypeID] || 'Workout';
    const dist = Number(log.distanceKM ?? log.DistanceKM ?? 0);
    if (dist > 0) {
      setMetricType('distance_km');
      setMetricValue(String(dist));
      setTitle(`${name}: ${dist.toFixed(1)} km`);
    } else {
      const dur = Number(log.duration ?? log.Duration ?? 0);
      setMetricType('duration_min');
      setMetricValue(String(dur));
      setTitle(`${name}: ${dur} min`);
    }
    setChooserOpen(false);
  };

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets?.length) {
        setImageUri(res.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open the photo library.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setMetricType('');
    setMetricValue('');
    setImageUri(null);
    setIsPublic(true);
  };

  const submitPost = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Give your post a title.');
      return;
    }
    setSubmitting(true);
    try {
      // Upload the photo first (if any) and post its returned path.
      let imagePath = null;
      if (imageUri) {
        try {
          const up = await uploadChatImage(imageUri);
          imagePath = up?.path ?? null;
        } catch {
          Alert.alert('Photo upload failed', 'Posting without the photo.');
        }
      }
      await createBoardPost({
        userID: userId,
        postType: 'record',
        title: title.trim(),
        description: description.trim() || null,
        metricType: metricType || null,
        metricValue: metricValue ? Number(metricValue) : null,
        imagePath,
        isPublic,
      });
      setModalOpen(false);
      resetForm();
      load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data || 'Could not post.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderPost = ({ item }) => {
    const author = {
      fullName: item.authorName ?? item.AuthorName,
      profileImagePath: item.authorImagePath ?? item.AuthorImagePath,
      equippedBadge: item.equippedBadge ?? item.EquippedBadge,
      equippedTitle: item.equippedTitle ?? item.EquippedTitle,
      equippedFrame: item.equippedFrame ?? item.EquippedFrame,
    };
    const authorId = item.userID ?? item.UserID;
    const liked = item.likedByMe ?? item.LikedByMe;
    const likeCount = item.likeCount ?? item.LikeCount ?? 0;
    const pill = metricPill(item.metricType ?? item.MetricType, item.metricValue ?? item.MetricValue);
    const created = parseServerDate(item.createdAt ?? item.CreatedAt);
    const isMine = authorId === userId;
    const friendStatus = item.friendStatus ?? item.FriendStatus; // null|pending|accepted|declined
    const isFriend = friendStatus === 'accepted';
    const isPending = friendStatus === 'pending';

    // Only offer "add friend" when not mine, not already friends, and not a
    // pending request (item 6 — prevents sending a request to a current friend).
    let rightEl = null;
    if (isMine) {
      rightEl = (
        <TouchableOpacity onPress={() => onDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={18} color={styles._muted} />
        </TouchableOpacity>
      );
    } else if (isFriend) {
      rightEl = <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />;
    } else if (isPending) {
      rightEl = <Ionicons name="hourglass-outline" size={18} color={styles._muted} />;
    } else {
      rightEl = (
        <TouchableOpacity style={styles.addChip} onPress={() => onAddFriend(item)}>
          <Ionicons name="person-add" size={15} color={Colors.primary} />
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.card}>
        <UserProfileCard
          user={author}
          size={42}
          subtitle={timeAgo(created)}
          right={rightEl}
        />
        <Text style={styles.postTitle}>{item.title ?? item.Title}</Text>
        {pill && (
          <View style={styles.metricPill}>
            <Text style={styles.metricPillText}>{pill}</Text>
          </View>
        )}
        {(item.description ?? item.Description) ? (
          <Text style={styles.postDesc}>{item.description ?? item.Description}</Text>
        ) : null}
        {(item.imagePath ?? item.ImagePath) ? (
          <Image
            source={{ uri: resolveProfileImageUrl(item.imagePath ?? item.ImagePath) }}
            style={styles.postImage}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.likeBtn} onPress={() => onLike(item)} activeOpacity={0.7}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? Colors.danger : styles._muted} />
            <Text style={styles.likeCount}>{likeCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Workout Board</Text>
        <Text style={styles.subtitle}>What your community is doing</Text>
      </View>
      <ConnectTabs active="board" navigation={navigation} />

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.postId ?? p.PostId)}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <Text style={styles.empty}>No posts yet. Be the first to share a workout!</Text>
          }
        />
      )}

      {/* Share FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create post modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => { setModalOpen(false); resetForm(); }}>
        <Pressable style={styles.backdrop} onPress={() => { setModalOpen(false); resetForm(); }}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Share a workout</Text>

            <TouchableOpacity style={styles.prefillBtn} onPress={openChooser} activeOpacity={0.85}>
              <Ionicons name="barbell" size={16} color={Colors.primary} />
              <Text style={styles.prefillText}>Choose a workout to share</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Title (e.g. New 10K PR!)"
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.inputArea]}
              placeholder="Say something (optional)"
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.label}>Metric (optional)</Text>
            <View style={styles.chipRow}>
              {METRICS.map(([key, lbl]) => (
                <TouchableOpacity
                  key={key || 'none'}
                  style={[styles.chip, metricType === key && styles.chipActive]}
                  onPress={() => setMetricType(key)}
                >
                  <Text style={[styles.chipText, metricType === key && styles.chipTextActive]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {metricType ? (
              <TextInput
                style={styles.input}
                placeholder="Value"
                placeholderTextColor={Colors.textMuted}
                value={metricValue}
                onChangeText={setMetricValue}
                keyboardType="decimal-pad"
              />
            ) : null}

            {/* Photo (item 9) */}
            {imageUri ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
                <TouchableOpacity style={styles.previewRemove} onPress={() => setImageUri(null)}>
                  <Ionicons name="close-circle" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoBtn} onPress={pickImage} activeOpacity={0.85}>
                <Ionicons name="image" size={18} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Add a photo</Text>
              </TouchableOpacity>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.label}>Public (everyone in your country)</Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setModalOpen(false); resetForm(); }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.postBtn} onPress={submitPost} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.postBtnText}>Post</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Workout chooser (item 5) */}
      <Modal visible={chooserOpen} transparent animationType="slide" onRequestClose={() => setChooserOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setChooserOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Choose a workout</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {recentLogs.map((log) => {
                const id = log.activityID ?? log.ActivityID ?? `${log.startTime ?? log.StartTime}`;
                const name = typesById[log.activityTypeID ?? log.ActivityTypeID] || 'Workout';
                const dist = Number(log.distanceKM ?? log.DistanceKM ?? 0);
                const dur = Number(log.duration ?? log.Duration ?? 0);
                const when = parseServerDate(log.startTime ?? log.StartTime);
                return (
                  <TouchableOpacity key={id} style={styles.chooserRow} onPress={() => prefillFromLog(log)} activeOpacity={0.8}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chooserName}>{name}</Text>
                      <Text style={styles.chooserMeta}>
                        {when.toLocaleDateString()}{dist > 0 ? ` · ${dist.toFixed(1)} km` : ''}{dur > 0 ? ` · ${dur} min` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={styles._muted} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const makeStyles = (C) => {
  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    header: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
    title: { color: C.primary, fontSize: 28, fontWeight: '900', fontStyle: 'italic' },
    subtitle: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
    listContent: { paddingHorizontal: 16, paddingBottom: 90 },
    empty: { color: C.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },

    card: {
      backgroundColor: C.cardBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginBottom: 12,
    },
    addChip: {
      width: 36, height: 36, borderRadius: 18,
      borderWidth: 1.5, borderColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    postTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 10 },
    metricPill: {
      alignSelf: 'flex-start',
      backgroundColor: C.cardBackgroundLight,
      borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8,
      borderWidth: 1, borderColor: C.border,
    },
    metricPillText: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
    postDesc: { color: C.textSecondary, fontSize: 14, lineHeight: 19, marginTop: 8 },
    postImage: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      marginTop: 10,
      backgroundColor: C.cardBackgroundLight,
    },
    postFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    likeCount: { color: C.textSecondary, fontSize: 14, fontWeight: '700' },

    fab: {
      position: 'absolute', right: 20, bottom: 24,
      width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center', elevation: 6,
    },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.cardBackground, borderTopLeftRadius: 22, borderTopRightRadius: 22,
      padding: 20, paddingBottom: 34, borderWidth: 1, borderColor: C.border,
    },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 14 },
    sheetTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 12 },
    prefillBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
      borderWidth: 1, borderColor: C.primary, backgroundColor: C.cardBackgroundLight, marginBottom: 12,
    },
    prefillText: { color: C.primary, fontSize: 13, fontWeight: '800' },
    chooserRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    chooserName: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
    chooserMeta: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
    input: {
      backgroundColor: C.inputBackground, borderRadius: 10, padding: 12, color: C.textPrimary,
      borderWidth: 1, borderColor: C.inputBorder, fontSize: 15, marginBottom: 10,
    },
    inputArea: { minHeight: 70, textAlignVertical: 'top' },
    photoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
      paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
      borderWidth: 1, borderColor: C.primary, backgroundColor: C.cardBackgroundLight, marginBottom: 10,
    },
    photoBtnText: { color: C.primary, fontSize: 13, fontWeight: '800' },
    previewWrap: { position: 'relative', marginBottom: 10 },
    preview: { width: '100%', height: 180, borderRadius: 12, backgroundColor: C.cardBackgroundLight },
    previewRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14 },
    label: { color: C.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    chip: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
      borderWidth: 1, borderColor: C.inputBorder, backgroundColor: C.inputBackground,
    },
    chipActive: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { color: C.textSecondary, fontSize: 13 },
    chipTextActive: { color: '#fff', fontWeight: '700' },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 14 },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
    cancelText: { color: C.textSecondary, fontSize: 15, fontWeight: '800' },
    postBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: C.primary },
    postBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });
  s._muted = C.textMuted;
  return s;
};

export default WorkoutBoardScreen;
