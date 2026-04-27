import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { useHealthSync } from './HealthSyncContext';
import { getActivityLogs, putActivityLog, deleteActivityLog } from './api';
import { calculateDailyLoad } from '../services/api';
import { Colors } from '../theme/colors';
import { tombstoneWorkout, loadHcTombstones } from '../constants/hcTombstones';

/**
 * GoogleFitScreen
 *
 * Health Connect workout review screen. Sync from HC → backend happens
 * automatically in HealthSyncContext on app open and on app foreground.
 * This screen shows the resulting workouts and lets the user confirm each
 * one (set exertion level) so it counts toward training load.
 */
const GoogleFitScreen = () => {
  const { userId } = useAuth();
  const {
    permissionsGranted,
    requestHCPermissions,
    refreshUnconfirmedCount,
    runAutoSync,
    isSyncing,
    lastSyncError,
  } = useHealthSync();

  const [workouts, setWorkouts] = useState([]);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingWorkout, setConfirmingWorkout] = useState(null);
  const [exertionLevel, setExertionLevel] = useState(5);
  const [savingConfirm, setSavingConfirm] = useState(false);

  /**
   * Load activity logs from backend to display to user.
   */
  const loadWorkouts = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoadingWorkouts(true);
      const logs = await getActivityLogs(userId);
      const sorted = logs.sort(
        (a, b) => new Date(b.startTime) - new Date(a.startTime)
      );
      setWorkouts(sorted);
    } catch (err) {
      console.error('Error loading workouts:', err);
    } finally {
      setIsLoadingWorkouts(false);
    }
  }, [userId]);

  // Refresh the on-screen list every time the user opens the Health tab.
  // The actual HC→backend sync runs in HealthSyncContext on app open /
  // foreground — no buttons needed.
  useFocusEffect(
    useCallback(() => {
      loadHcTombstones();
      loadWorkouts();
    }, [loadWorkouts])
  );

  /**
   * Pull-to-refresh fallback: triggers a fresh HC→backend sync, then
   * reloads the list and badge count.
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await runAutoSync();
      await loadWorkouts();
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * One-time setup: request Health Connect permissions. After grant the
   * provider's auto-sync will pull the user's workouts in.
   */
  const handleRequestPermissions = async () => {
    const granted = await requestHCPermissions();
    if (granted) {
      Alert.alert('Connected', 'Health Connect permissions granted.');
      await runAutoSync();
      await loadWorkouts();
      return;
    }
    Alert.alert(
      'Health Connect',
      lastSyncError ||
        'Could not open Health Connect. Please make sure it is installed and up to date.'
    );
  };

  const handleDeleteWorkout = (workout) => {
    Alert.alert(
      'Delete workout?',
      'This permanently removes the workout from your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteActivityLog(workout.activityID);
              // Tombstone Health-Connect-sourced workouts so the next
              // auto-sync does NOT re-import the same row. Manual logs
              // never re-appear (they don't exist in HC) so skipping
              // the tombstone for them keeps the set small.
              if (workout.sourceDevice === 'Health Connect') {
                await tombstoneWorkout(workout);
              }
              try {
                const sessionDate = new Date(workout.startTime);
                await calculateDailyLoad(userId, sessionDate);
                const today = new Date();
                if (sessionDate.toDateString() !== today.toDateString()) {
                  await calculateDailyLoad(userId, today);
                }
              } catch (recalcErr) {
                console.warn('Recalc failed:', recalcErr.message);
              }
              await loadWorkouts();
              await refreshUnconfirmedCount();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete workout.');
            }
          },
        },
      ],
    );
  };

  const openConfirmModal = (workout) => {
    if (workout.isConfirmed) return;
    setConfirmingWorkout(workout);
    setExertionLevel(workout.exertionLevel || 5);
  };

  const closeConfirmModal = () => {
    setConfirmingWorkout(null);
    setSavingConfirm(false);
  };

  const submitConfirm = async () => {
    if (!confirmingWorkout) return;
    try {
      setSavingConfirm(true);
      await putActivityLog({
        activityID: confirmingWorkout.activityID,
        activityTypeID: confirmingWorkout.activityTypeID,
        startTime: confirmingWorkout.startTime,
        endTime: confirmingWorkout.endTime,
        distanceKM: confirmingWorkout.distanceKM || 0,
        avgHeartRate: confirmingWorkout.avgHeartRate ?? null,
        maxHeartRate: confirmingWorkout.maxHeartRate ?? null,
        caloriesBurned: confirmingWorkout.caloriesBurned ?? null,
        sourceDevice: confirmingWorkout.sourceDevice || 'Health Connect',
        exertionLevel,
        duration: confirmingWorkout.duration || 0,
        isConfirmed: true,
      });
      closeConfirmModal();
      await loadWorkouts();
      await refreshUnconfirmedCount();
      Alert.alert('Workout Confirmed', 'Exertion level saved. Your training load will update on next refresh.');
    } catch (err) {
      setSavingConfirm(false);
      Alert.alert('Error', err.message || 'Failed to confirm workout');
    }
  };

  /**
   * Format time for display.
   * @param {string|Date} isoString - ISO string or Date object
   * @returns {string} Formatted time (e.g., "2:30 PM")
   */
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Jerusalem',
      });
    } catch {
      return 'N/A';
    }
  };

  /**
   * Format date for display.
   * @param {string|Date} isoString - ISO string or Date object
   * @returns {string} Formatted date (e.g., "Jan 15, 2025")
   */
  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Jerusalem',
      });
    } catch {
      return 'N/A';
    }
  };

  /**
   * Get activity type name from ID.
   * @param {number} typeId - Activity type ID
   * @returns {string} Activity type name
   */
  const getActivityTypeName = (typeId) => {
    const types = {
      1: 'Running',
      2: 'Walking',
      3: 'Cycling',
      4: 'Weightlifting',
      5: 'Other',
    };
    return types[typeId] || 'Unknown';
  };

  /**
   * Render a single workout item.
   */
  const renderWorkoutItem = ({ item }) => {
    const duration = item.duration || 0;
    const calories = item.caloriesBurned || 0;
    const distance = item.distanceKM || 0;
    const activityName = getActivityTypeName(item.activityTypeID);

    return (
      <TouchableOpacity
        style={styles.workoutCard}
        onPress={() => openConfirmModal(item)}
        activeOpacity={item.isConfirmed ? 1 : 0.7}
      >
        <View style={styles.workoutHeader}>
          <Text style={styles.activityName}>{activityName}</Text>
          <Text style={styles.workoutDate}>
            {formatDate(item.startTime)} • {formatTime(item.startTime)}
          </Text>
        </View>

        <View style={styles.workoutStats}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.statText}>{duration} min</Text>
          </View>

          {distance > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="map-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.statText}>{distance.toFixed(1)} km</Text>
            </View>
          )}

          {calories > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="flame-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.statText}>{Math.round(calories)} cal</Text>
            </View>
          )}

          {item.avgHeartRate > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="heart-outline" size={16} color="#e74c3c" />
              <Text style={styles.statText}>
                {Math.round(item.avgHeartRate)} bpm
              </Text>
            </View>
          )}
        </View>

        <View style={styles.workoutFooter}>
          <View
            style={[
              styles.statusBadge,
              item.isConfirmed ? styles.confirmed : styles.unconfirmed,
            ]}
          >
            <Ionicons
              name={item.isConfirmed ? 'checkmark-circle' : 'time-outline'}
              size={14}
              color={item.isConfirmed ? '#27ae60' : '#f39c12'}
            />
            <Text
              style={[
                styles.statusText,
                item.isConfirmed ? styles.confirmedText : styles.unconfirmedText,
              ]}
            >
              {item.isConfirmed ? 'Confirmed' : 'Pending'}
            </Text>
          </View>

          <Text style={styles.sourceText}>📲 {item.sourceDevice}</Text>
        </View>

        <TouchableOpacity
          style={styles.deleteRowBtn}
          onPress={() => handleDeleteWorkout(item)}
        >
          <Ionicons name="trash-outline" size={16} color="#e74c3c" />
          <Text style={styles.deleteRowBtnText}>Delete</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderConfirmModal = () => (
    <Modal
      visible={!!confirmingWorkout}
      transparent
      animationType="fade"
      onRequestClose={closeConfirmModal}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Confirm Workout</Text>
          {confirmingWorkout && (
            <Text style={styles.modalSubtitle}>
              {getActivityTypeName(confirmingWorkout.activityTypeID)} •{' '}
              {formatDate(confirmingWorkout.startTime)} •{' '}
              {formatTime(confirmingWorkout.startTime)}
            </Text>
          )}

          <Text style={styles.modalLabel}>How hard was it? (1–10)</Text>
          <View style={styles.exertionRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
              const selected = n === exertionLevel;
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => setExertionLevel(n)}
                  style={[
                    styles.exertionChip,
                    selected && styles.exertionChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.exertionChipText,
                      selected && styles.exertionChipTextSelected,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, styles.modalButton]}
              onPress={closeConfirmModal}
              disabled={savingConfirm}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, styles.modalButton]}
              onPress={submitConfirm}
              disabled={savingConfirm}
            >
              {savingConfirm ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Confirm</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  /**
   * Render empty state message.
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="fitness-outline" size={64} color="#bdc3c7" />
      <Text style={styles.emptyText}>No workouts yet</Text>
      <Text style={styles.emptySubtext}>
        Connect Health Connect and sync your workouts to see them here
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.title}>Health Connect</Text>

        {/* Connection Status */}
        <View
          style={[
            styles.statusIndicator,
            permissionsGranted ? styles.connected : styles.disconnected,
          ]}
        >
          <Ionicons
            name={permissionsGranted ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={permissionsGranted ? '#27ae60' : '#e74c3c'}
          />
          <Text
            style={[
              styles.statusIndicatorText,
              permissionsGranted ? styles.connectedText : styles.disconnectedText,
            ]}
          >
            {permissionsGranted ? 'Connected' : 'Not Connected'}
          </Text>
        </View>
      </View>

      {/* Background-sync error banner */}
      {lastSyncError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={20} color="#e74c3c" />
          <Text style={styles.errorText}>{lastSyncError}</Text>
        </View>
      )}

      {/* One-time setup: only shown when permissions are missing */}
      {!permissionsGranted && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleRequestPermissions}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="link-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Connect Health Connect</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Hint banner: tells the user how the new flow works */}
      {permissionsGranted && (
        <View style={styles.hintBanner}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.hintText}>
            New workouts sync automatically. Tap a Pending workout to confirm it.
          </Text>
        </View>
      )}

      {renderConfirmModal()}

      {/* Workouts List */}
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.activityID?.toString() || Math.random().toString()}
        renderItem={renderWorkoutItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 12,
  },

  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },

  connected: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },

  disconnected: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },

  statusIndicatorText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },

  connectedText: {
    color: Colors.success,
  },

  disconnectedText: {
    color: Colors.danger,
  },

  lastSyncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.cardBackgroundLight,
    marginHorizontal: 0,
    marginTop: 8,
  },

  lastSyncText: {
    marginLeft: 8,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginTop: 8,
  },

  errorText: {
    marginLeft: 12,
    fontSize: 13,
    color: Colors.danger,
    flex: 1,
  },

  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginTop: 8,
  },

  successText: {
    marginLeft: 12,
    fontSize: 13,
    color: Colors.success,
    fontWeight: '500',
  },

  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.cardBackgroundLight,
  },

  hintText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  buttonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.cardBackground,
    gap: 10,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 10,
  },

  primaryButton: {
    backgroundColor: Colors.primary,
  },

  buttonText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  secondaryButton: {
    backgroundColor: Colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },

  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },

  workoutCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },

  workoutHeader: {
    marginBottom: 10,
  },

  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },

  workoutDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  workoutStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },

  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  statText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  workoutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },

  confirmed: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },

  unconfirmed: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
  },

  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  confirmedText: {
    color: Colors.success,
  },

  unconfirmedText: {
    color: Colors.warning,
  },

  sourceText: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 16,
  },

  emptySubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  modalCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },

  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },

  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },

  exertionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },

  exertionChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  exertionChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  exertionChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  exertionChipTextSelected: {
    color: Colors.textPrimary,
  },

  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },

  modalButton: {
    flex: 1,
  },

  deleteRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e74c3c',
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
  },

  deleteRowBtnText: {
    color: '#e74c3c',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default GoogleFitScreen;
