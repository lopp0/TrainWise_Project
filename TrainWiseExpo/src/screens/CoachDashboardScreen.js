import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../api/AuthContext';
import { useMessages } from '../api/MessagesContext';
import {
  getCoachByUserId,
  getTraineesByCoach,
  disconnectCoachTrainee,
  getActivityLogsByUser,
} from '../services/api';
import HomeHeader from '../components/HomeHeader';
import { processCheckIn } from '../utils/checkInManager';
import { computeACWR } from '../utils/acwr';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * Maps the backend LoadLevel string (Green/Yellow/Red) to a status color.
 * Falls back to AC ratio when LoadLevel is missing, using the strict
 * thresholds documented in CLAUDE.md (>1.3 red, 0.8–1.3 yellow, <0.8 green).
 */
export const loadLevelColor = (level, acRatio) => {
  const lvl = (level || '').toLowerCase();
  if (lvl === 'red') return '#f44336';
  if (lvl === 'yellow') return '#ffee58';
  if (lvl === 'green') return '#00e676';
  if (acRatio == null) return Colors.textMuted;
  if (acRatio > 1.3) return '#f44336';
  if (acRatio >= 0.8) return '#ffee58';
  return '#00e676';
};

export const loadLevelLabel = (level, acRatio) => {
  const lvl = (level || '').toLowerCase();
  if (lvl === 'red') return 'High overload';
  if (lvl === 'yellow') return 'Caution';
  if (lvl === 'green') return 'Safe';
  if (acRatio == null) return 'No data';
  if (acRatio > 1.3) return 'High overload';
  if (acRatio >= 0.8) return 'Caution';
  return 'Safe';
};

const ageFromBirthYear = (birthYear) => {
  if (!birthYear || birthYear <= 0) return null;
  return new Date().getFullYear() - birthYear;
};

const CoachDashboardScreen = ({ navigation }) => {
  const { userId, user } = useAuth();
  const { unreadCount } = useMessages();
  const styles = useThemedStyles(makeStyles);

  const [coachId, setCoachId] = useState(null);
  const [checkInState, setCheckInState] = useState({ streak: 0, coins: 0 });
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      // Resolve this user's coach profile (CoachID differs from UserID).
      const coachRes = await getCoachByUserId(userId);
      const cid = coachRes.data?.coachID ?? coachRes.data?.CoachID;
      setCoachId(cid);

      const res = await getTraineesByCoach(cid);
      const base = Array.isArray(res.data) ? res.data : [];
      // Recompute each trainee's AC ratio from their confirmed ActivityLogs with
      // the same client-side formula the trainee sees, so the coach number
      // matches the trainee's (the stored DailyLoad lacks the cold-start floor).
      const withRatio = await Promise.all(
        base.map(async (t) => {
          try {
            const logsRes = await getActivityLogsByUser(t.userID ?? t.UserID);
            const acwr = computeACWR(logsRes.data, t.experienceLevel ?? t.ExperienceLevel);
            return { ...t, aC_Ratio: acwr.ratio, AC_Ratio: acwr.ratio, loadLevel: acwr.level, LoadLevel: acwr.level };
          } catch {
            return t; // fall back to the server value on failure
          }
        })
      );
      setTrainees(withRatio);
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) {
        // No coach row yet — treat as an empty roster, not a hard error.
        setTrainees([]);
      } else {
        setError(e.response?.data || e.message || 'Failed to load trainees');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      processCheckIn()
        .then((r) => setCheckInState({ streak: r.streak, coins: r.coins }))
        .catch(() => {});
    }, [loadDashboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleRemove = (trainee) => {
    Alert.alert(
      'Remove trainee',
      `Stop following ${trainee.fullName || 'this trainee'}? You will lose access to their training data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectCoachTrainee(coachId, trainee.userID ?? trainee.UserID);
              setTrainees((prev) =>
                prev.filter(
                  (t) => (t.userID ?? t.UserID) !== (trainee.userID ?? trainee.UserID)
                )
              );
            } catch (e) {
              Alert.alert('Error', e.response?.data || 'Could not remove trainee.');
            }
          },
        },
      ]
    );
  };

  const riskCount = trainees.filter((t) => {
    const c = loadLevelColor(t.loadLevel ?? t.LoadLevel, t.aC_Ratio ?? t.AC_Ratio);
    return c === '#f44336' || c === '#ffee58';
  }).length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* B-1 parity: same top bar as the trainee side so coaches can reach
          Profile (and Log out), Settings, Shop, My Network, etc. */}
      <HomeHeader
        navigation={navigation}
        selfId={userId}
        profileImagePath={user?.profileImagePath}
        fullName={user?.fullName}
        streak={checkInState.streak}
        coins={checkInState.coins}
        unreadCount={unreadCount}
        coachOnly
      />
      <View style={styles.titleRow}>
        <Text style={styles.headerTitle}>Coach Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          {user?.fullName ? `Coach ${user.fullName}` : 'Your trainees'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator
            color={Colors.primary}
            size="large"
            style={{ marginTop: 60 }}
          />
        ) : (
          <>
            {/* Summary strip */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{trainees.length}</Text>
                <Text style={styles.summaryLabel}>Trainees</Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={[styles.summaryValue, { color: '#ff9800' }]}>
                  {riskCount}
                </Text>
                <Text style={styles.summaryLabel}>Need attention</Text>
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {trainees.length === 0 && !error ? (
              <View style={styles.empty}>
                <Ionicons
                  name="people-outline"
                  size={54}
                  color={Colors.textMuted}
                />
                <Text style={styles.emptyTitle}>No trainees yet</Text>
                <Text style={styles.emptyText}>
                  Connect with a trainee by scanning their TrainWise QR code.
                </Text>
              </View>
            ) : (
              trainees.map((t) => {
                const uid = t.userID ?? t.UserID;
                const acRatio = t.aC_Ratio ?? t.AC_Ratio;
                const level = t.loadLevel ?? t.LoadLevel;
                const color = loadLevelColor(level, acRatio);
                const age = ageFromBirthYear(t.birthYear ?? t.BirthYear);
                const lastDate = t.lastDate ?? t.LastDate;
                return (
                  <TouchableOpacity
                    key={uid}
                    style={styles.card}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate('CoachTraineeDetail', {
                        coachId,
                        trainee: t,
                      })
                    }
                    onLongPress={() => handleRemove(t)}
                  >
                    <View style={[styles.statusDot, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.traineeName}>
                        {t.fullName ?? t.FullName ?? `User #${uid}`}
                      </Text>
                      <Text style={styles.traineeMeta}>
                        {[
                          age ? `${age} yrs` : null,
                          t.gender ?? t.Gender,
                          loadLevelLabel(level, acRatio),
                        ]
                          .filter(Boolean)
                          .join('  •  ')}
                      </Text>
                      {lastDate && (
                        <Text style={styles.traineeDate}>
                          Last load: {new Date(lastDate).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.cardRight}>
                      <Text style={[styles.acRatio, { color }]}>
                        {acRatio != null ? Number(acRatio).toFixed(2) : '—'}
                      </Text>
                      <Text style={styles.acLabel}>AC ratio</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })
            )}

            <Text style={styles.hint}>
              Tip: long-press a trainee to remove them.
            </Text>
          </>
        )}
      </ScrollView>

      {/* Add trainee FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ConnectQR')}
      >
        <Ionicons name="qr-code-outline" size={22} color={Colors.textPrimary} />
        <Text style={styles.fabText}>Connect trainee</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const makeStyles = (C) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    titleRow: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 10,
    },
    headerTitle: {
      color: C.primary,
      fontSize: 26,
      fontWeight: '900',
      fontStyle: 'italic',
    },
    headerSubtitle: {
      color: C.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    settingsBtn: { padding: 4 },
    scroll: { paddingHorizontal: 16, paddingBottom: 120 },

    summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    summaryBox: {
      flex: 1,
      backgroundColor: C.cardBackground,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    summaryValue: { color: C.textPrimary, fontSize: 26, fontWeight: '900' },
    summaryLabel: { color: C.textSecondary, fontSize: 12, marginTop: 2 },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.cardBackground,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    statusDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      marginRight: 12,
    },
    traineeName: { color: C.textPrimary, fontSize: 16, fontWeight: '800' },
    traineeMeta: { color: C.textSecondary, fontSize: 12, marginTop: 3 },
    traineeDate: { color: C.textMuted, fontSize: 11, marginTop: 2 },
    cardRight: { alignItems: 'center', marginRight: 8 },
    acRatio: { fontSize: 18, fontWeight: '900' },
    acLabel: { color: C.textMuted, fontSize: 10 },

    empty: { alignItems: 'center', paddingVertical: 50 },
    emptyTitle: {
      color: C.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 12,
    },
    emptyText: {
      color: C.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      marginTop: 6,
      paddingHorizontal: 30,
      lineHeight: 19,
    },
    errorText: {
      color: '#f44336',
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 12,
    },
    hint: {
      color: C.textMuted,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 8,
    },

    fab: {
      position: 'absolute',
      bottom: 20,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.primary,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 30,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5,
    },
    fabText: { color: C.textPrimary, fontSize: 15, fontWeight: '800' },
  });

export default CoachDashboardScreen;
