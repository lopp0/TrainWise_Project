import React, { useCallback, useEffect, useRef, useState } from 'react';
import ScreenTutorial from '../components/ScreenTutorial';
import { isTutorialDone, markTutorialDone } from '../utils/tutorialManager';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import {
  getCoachMarketplace,
  getCoachReviews,
  upsertCoachReview,
} from '../services/api';
import Avatar from '../components/Avatar';
import { experienceLabel } from '../utils/experience';
import { parseServerDate } from '../utils/serverDate';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * #169 — Coach marketplace + ratings/reviews. Browse coaches sorted by rating,
 * search by name, read reviews. A coach's current trainees can leave/update a
 * single review (enforced server-side).
 */
const Stars = ({ value, size = 14, color }) => {
  const C = color;
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <View style={{ flexDirection: 'row' }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const name = i < full ? 'star' : i === full && half ? 'star-half' : 'star-outline';
        return <Ionicons key={i} name={name} size={size} color={C} />;
      })}
    </View>
  );
};

const COACH_MARKETPLACE_TUTORIAL_STEPS = [
  {
    icon: '🔎',
    title: 'Browse Coaches',
    body: 'Search by name or sort by top rated. Every coach shows their rating, experience, and how many trainees they have.',
  },
  {
    icon: '⭐',
    title: 'Read Reviews',
    body: 'Tap any coach to see reviews from their trainees before you decide to connect with them.',
  },
  {
    icon: '✍️',
    title: 'Leave a Review',
    body: "Once you're connected to a coach, you can rate them 1-5 stars and share your experience. You can update it any time.",
  },
];

const CoachMarketplaceScreen = ({ navigation, route }) => {
  const openCoachId = route?.params?.openCoachId ?? null; // 5b — arrive from the map
  const { userId } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState([]);
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    isTutorialDone('coachMarketplace').then((d) => { if (!d) setShowTutorial(true); });
  }, []);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('rating');

  const [reviewsOf, setReviewsOf] = useState(null); // coach item
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCoachMarketplace(userId, { search: search.trim() || null, sort });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId, search, sort]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 5b — when opened from the Connect map for a specific coach, auto-open their
  // reviews once the list has loaded.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!openCoachId || autoOpened.current || items.length === 0) return;
    const coach = items.find((c) => (c.userID ?? c.UserID) === openCoachId);
    if (coach) { autoOpened.current = true; openReviews(coach); }
  }, [openCoachId, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const openReviews = async (coach) => {
    setReviewsOf(coach);
    setReviews([]);
    setMyRating(0);
    setMyText('');
    setLoadingReviews(true);
    try {
      const res = await getCoachReviews(coach.userID ?? coach.UserID);
      const list = Array.isArray(res.data) ? res.data : [];
      setReviews(list);
      const mine = list.find((r) => (r.reviewerUserID ?? r.ReviewerUserID) === userId);
      if (mine) {
        setMyRating(mine.rating ?? mine.Rating ?? 0);
        setMyText(mine.text ?? mine.Text ?? '');
      }
    } catch {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const submitReview = async () => {
    if (myRating < 1) {
      Alert.alert('Pick a rating', 'Tap the stars to rate this coach.');
      return;
    }
    setSavingReview(true);
    try {
      await upsertCoachReview(reviewsOf.userID ?? reviewsOf.UserID, userId, myRating, myText.trim() || null);
      await openReviews(reviewsOf);
      load();
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data?.toString?.() || 'Only a coach’s trainees can review them.');
    } finally {
      setSavingReview(false);
    }
  };

  const renderCoach = ({ item }) => {
    const avg = item.avgRating ?? item.AvgRating ?? 0;
    const count = item.reviewCount ?? item.ReviewCount ?? 0;
    const isMine = item.isMyCoach ?? item.IsMyCoach;
    return (
      <TouchableOpacity style={styles.card} onPress={() => openReviews(item)} activeOpacity={0.85}>
        <Avatar
          user={{ fullName: item.fullName ?? item.FullName, profileImagePath: item.profileImagePath ?? item.ProfileImagePath }}
          size={48}
          online={item.isOnline ?? item.IsOnline}
        />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.fullName ?? item.FullName}</Text>
            {isMine && <View style={styles.myBadge}><Text style={styles.myBadgeText}>My coach</Text></View>}
          </View>
          <View style={styles.ratingRow}>
            <Stars value={avg} color={Colors.warning} />
            <Text style={styles.ratingText}>
              {avg > 0 ? avg.toFixed(1) : 'New'} {count > 0 ? `(${count})` : ''}
            </Text>
          </View>
          <Text style={styles.sub}>
            {experienceLabel(item.experienceLevel ?? item.ExperienceLevel)} · {item.traineeCount ?? item.TraineeCount} trainees
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Find a coach</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={load}
          placeholder="Search coaches by name"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => { setSearch(''); }}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sortRow}>
        {[['rating', 'Top rated'], ['name', 'A–Z']].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.sortBtn, sort === key && styles.sortBtnActive]}
            onPress={() => setSort(key)}
          >
            <Text style={[styles.sortText, sort === key && styles.sortTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c, i) => String(c.userID ?? c.UserID ?? i)}
          renderItem={renderCoach}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>No coaches found.</Text>}
        />
      )}

      {/* Reviews modal */}
      <Modal visible={!!reviewsOf} transparent animationType="slide" onRequestClose={() => setReviewsOf(null)}>
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{reviewsOf?.fullName ?? reviewsOf?.FullName}</Text>
              <TouchableOpacity onPress={() => setReviewsOf(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {(reviewsOf?.isMyCoach ?? reviewsOf?.IsMyCoach) ? (
              <View style={styles.writeBox}>
                <Text style={styles.writeLabel}>Your review</Text>
                <View style={styles.starPick}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setMyRating(n)} hitSlop={4}>
                      <Ionicons name={n <= myRating ? 'star' : 'star-outline'} size={28} color={Colors.warning} />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.reviewInput}
                  value={myText}
                  onChangeText={setMyText}
                  placeholder="Share your experience (optional)"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  maxLength={600}
                />
                <TouchableOpacity style={styles.saveReviewBtn} onPress={submitReview} disabled={savingReview}>
                  {savingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveReviewText}>Save review</Text>}
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={styles.reviewsHeading}>Reviews</Text>
            {loadingReviews ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {reviews.length === 0 ? (
                  <Text style={styles.empty}>No reviews yet.</Text>
                ) : reviews.map((r, i) => (
                  <View key={r.reviewID ?? r.ReviewID ?? i} style={styles.reviewRow}>
                    <Avatar user={{ fullName: r.reviewerName ?? r.ReviewerName, profileImagePath: r.reviewerImage ?? r.ReviewerImage }} size={32} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.reviewTop}>
                        <Text style={styles.reviewName} numberOfLines={1}>{r.reviewerName ?? r.ReviewerName}</Text>
                        <Stars value={r.rating ?? r.Rating ?? 0} size={12} color={Colors.warning} />
                      </View>
                      {(r.text ?? r.Text) ? <Text style={styles.reviewText}>{r.text ?? r.Text}</Text> : null}
                      <Text style={styles.reviewDate}>
                        {parseServerDate(r.createdAt ?? r.CreatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <ScreenTutorial
        visible={showTutorial}
        steps={COACH_MARKETPLACE_TUTORIAL_STEPS}
        onFinish={() => { setShowTutorial(false); markTutorialDone('coachMarketplace'); }}
      />
    </SafeAreaView>
  );
};

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8,
  },
  title: { color: C.primary, fontSize: 22, fontWeight: '900', fontStyle: 'italic' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8,
    backgroundColor: C.inputBackground, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: C.inputBorder,
  },
  searchInput: { flex: 1, color: C.textPrimary, fontSize: 15, padding: 0 },
  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  sortBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.cardBackground,
  },
  sortBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  sortText: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
  sortTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.cardBackground, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: C.textPrimary, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  myBadge: { backgroundColor: C.primary + '22', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  myBadgeText: { color: C.primary, fontSize: 10, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  ratingText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
  sub: { color: C.textMuted, fontSize: 12, marginTop: 3 },
  empty: { color: C.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.cardBackground, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '900', flex: 1 },
  writeBox: { backgroundColor: C.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  writeLabel: { color: C.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  starPick: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  reviewInput: {
    backgroundColor: C.inputBackground, borderRadius: 10, padding: 10, minHeight: 56,
    color: C.textPrimary, fontSize: 14, textAlignVertical: 'top', borderWidth: 1, borderColor: C.inputBorder,
  },
  saveReviewBtn: { marginTop: 10, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  saveReviewText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  reviewsHeading: { color: C.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginBottom: 8 },
  reviewRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reviewName: { color: C.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  reviewText: { color: C.textSecondary, fontSize: 13, marginTop: 3, lineHeight: 18 },
  reviewDate: { color: C.textMuted, fontSize: 11, marginTop: 3 },
});

export default CoachMarketplaceScreen;
