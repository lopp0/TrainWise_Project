import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '../api/AuthContext';
import { getActivityFeed, resolveProfileImageUrl } from '../services/api';
import Avatar from '../components/Avatar';
import { parseServerDate } from '../utils/serverDate';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #144 — Activity feed. A chronological stream of your friends' recent workouts
 * and workout-board posts. Read-only; tapping a post jumps to the board.
 */
const timeAgo = (d) => {
  if (!d) return '';
  const then = parseServerDate(d).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return parseServerDate(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
};

const FeedScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getActivityFeed(userId, 40);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const renderItem = ({ item }) => {
    const type = item.feedType ?? item.FeedType;
    const isPost = type === 'post';
    const img = item.imagePath ?? item.ImagePath;
    return (
      <TouchableOpacity
        activeOpacity={isPost ? 0.85 : 1}
        style={styles.card}
        onPress={() => { if (isPost) navigation.navigate('WorkoutBoard'); }}
      >
        <View style={styles.rowTop}>
          <Avatar
            user={{ fullName: item.actorName ?? item.ActorName, profileImagePath: item.actorImage ?? item.ActorImage }}
            size={40}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.actor}>
              {item.actorName ?? item.ActorName}
              <Text style={styles.action}>{isPost ? '  posted' : '  logged a workout'}</Text>
            </Text>
            <Text style={styles.time}>{timeAgo(item.createdAt ?? item.CreatedAt)}</Text>
          </View>
          <Ionicons
            name={isPost ? 'newspaper-outline' : 'barbell-outline'}
            size={18}
            color={Colors.primary}
          />
        </View>

        <Text style={styles.itemTitle}>{item.title ?? item.Title}</Text>
        {(item.subtitle ?? item.Subtitle) ? (
          <Text style={styles.subtitle} numberOfLines={3}>{item.subtitle ?? item.Subtitle}</Text>
        ) : null}
        {img ? (
          <ExpoImage source={{ uri: resolveProfileImageUrl(img) }} style={styles.image} contentFit="cover" />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Activity feed</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, i) => `${it.feedType ?? it.FeedType}-${it.refID ?? it.RefID}-${i}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="newspaper-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.empty}>Nothing here yet. Add friends and their recent workouts and posts will show up.</Text>
            </View>
          }
        />
      )}
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
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actor: { color: C.textPrimary, fontSize: 14, fontWeight: '800' },
  action: { color: C.textSecondary, fontSize: 13, fontWeight: '500' },
  time: { color: C.textMuted, fontSize: 11, marginTop: 1 },
  itemTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 10 },
  subtitle: { color: C.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  image: { width: '100%', height: 180, borderRadius: 10, marginTop: 10 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40, gap: 10 },
  empty: { color: C.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 20 },
});

export default FeedScreen;
