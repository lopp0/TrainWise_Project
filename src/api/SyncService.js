import {
  getStructuredWorkouts,
  initializeHealthConnect,
  checkPermissions,
  requestPermissions,
} from './HealthConnectService';
import {
  postActivityLog,
  getActivityLogs,

  putUserDevice,
} from './api';
import { loadHcTombstones, isTombstoned } from '../constants/hcTombstones';

/**
 * SyncService
 * 
 * Orchestrates the sync process between Health Connect and the TrainWise backend.
 * Handles deduplication, error management, and device sync tracking.
 */

/**
 * Get the last N days as a date range.
 * 
 * @param {number} days - Number of days to look back
 * @returns {Object} { startDate: Date, endDate: Date }
 */
const getDateRangeForDays = (days = 7) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return { startDate, endDate };
};

/**
 * Check if two workouts are the same based on start time.
 * Uses a 60-second tolerance to account for minor time differences.
 * 
 * @param {Object} hcWorkout - Health Connect workout
 * @param {Object} existingLog - Existing activity log from backend
 * @returns {boolean} true if workouts match
 */
const areWorkoutsDuplicate = (hcWorkout, existingLog) => {
  // Backend returns DateTime with Kind=Unspecified (no Z suffix), so
  // `new Date(...)` parses it as local time while HC sends UTC (Z) — a 2–3h
  // drift makes ms-comparison miss every match. Compare the wall-clock
  // portion at minute granularity instead.
  const normalize = (t) => String(t || '').replace(/Z$/, '').slice(0, 16);
  return normalize(hcWorkout.startTime) === normalize(existingLog.startTime);
};

/**
 * Filter workouts to exclude those that already exist in the backend.
 * 
 * @param {Array} healthConnectWorkouts - Workouts from Health Connect
 * @param {Array} existingLogs - Existing activity logs from backend
 * @returns {Object} { new: Array, duplicates: Array }
 */
const deduplicateWorkouts = (healthConnectWorkouts, existingLogs) => {
  const newWorkouts = [];
  const duplicates = [];
  const tombstoned = [];

  healthConnectWorkouts.forEach((hcWorkout) => {
    // Tombstones: if the user already deleted this HC workout from the
    // backend, HC still has it but we must NOT re-import. Without this,
    // every sync re-creates the deleted row as Pending.
    if (isTombstoned(hcWorkout)) {
      tombstoned.push(hcWorkout);
      return;
    }

    const isDuplicate = existingLogs.some((log) =>
      areWorkoutsDuplicate(hcWorkout, log)
    );

    if (isDuplicate) {
      duplicates.push(hcWorkout);
    } else {
      newWorkouts.push(hcWorkout);
    }
  });

  return { new: newWorkouts, duplicates, tombstoned };
};

/**
 * Post a single workout to the backend.
 * 
 * @param {Object} workout - Structured workout object
 * @returns {Promise<Object>} { success: boolean, data?: Object, error?: string }
 */
const postWorkout = async (workout) => {
  try {
    const result = await postActivityLog(workout);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error posting workout:', error);
    return {
      success: false,
      error: error.message || 'Failed to post workout',
    };
  }
};

/**
 * Update device's last sync timestamp.
 * 
 * @param {number} userId - User ID
 * @param {number} deviceId - Device ID
 * @returns {Promise<boolean>} true if successful
 */
const updateDeviceLastSync = async (userId, deviceId) => {
  if (!deviceId || typeof deviceId !== 'number') {
    // Non-numeric / locally-generated device ID — backend has no matching row.
    // Skip the housekeeping call; the main workout sync is already done.
    return true;
  }
  try {
    const deviceData = {
      lastSync: new Date().toISOString(),
      permissionsGranted: true,
    };

    await putUserDevice(userId, deviceId, deviceData);
    return true;
  } catch (error) {
    console.log('Skipping device lastSync update:', error.message);
    return false;
  }
};

/**
 * Main sync function.
 * Orchestrates the entire sync process:
 * 1. Initialize Health Connect
 * 2. Check permissions
 * 3. Fetch workouts for last 7 days
 * 4. Fetch existing logs from backend
 * 5. Deduplicate
 * 6. Post new workouts
 * 7. Update device lastSync
 * 
 * @param {number} userId - User ID (required)
 * @param {number} deviceId - Device ID (required)
 * @param {number} lookbackDays - Number of days to sync (default 7)
 * 
 * @returns {Promise<Object>} Sync result summary:
 *   {
 *     success: boolean,
 *     synced: number (workouts successfully posted),
 *     skipped: number (duplicate workouts),
 *     errors: Array (error details),
 *     workouts: Array (synced workout objects),
 *   }
 */
export const syncWorkoutsToBackend = async (
  userId,
  deviceId,
  lookbackDays = 7
) => {
  const result = {
    success: false,
    synced: 0,
    skipped: 0,
    errors: [],
    workouts: [],
  };

  try {
    if (!userId || !deviceId) {
      throw new Error('userId and deviceId are required');
    }

    console.log(
      `Starting sync for user ${userId}, device ${deviceId}, lookback ${lookbackDays} days`
    );

    // Step 1: Verify Health Connect is initialized
    console.log('Step 1: Initializing Health Connect...');
    const isAvailable = await initializeHealthConnect();
    if (!isAvailable) {
      throw new Error('Health Connect is not available on this device');
    }

    // Step 2: Check permissions; if any are missing, prompt instead of aborting.
    console.log('Step 2: Checking permissions...');
    let permStatus = await checkPermissions();
    let allGranted =
      permStatus.granted.length >= permStatus.permissions.length;

    if (!allGranted) {
      console.log('Step 2a: Permissions missing, prompting user...');
      const prompted = await requestPermissions();
      permStatus = prompted;
      allGranted = prompted.granted.length >= prompted.permissions.length;
    }

    if (!allGranted) {
      throw new Error('Permissions were denied. Please grant them in Health Connect settings.');
    }

    // Step 3: Fetch workouts from Health Connect
    console.log('Step 3: Fetching workouts from Health Connect...');
    const { startDate, endDate } = getDateRangeForDays(lookbackDays);
    const healthConnectWorkouts = await getStructuredWorkouts(startDate, endDate);
    
    if (!healthConnectWorkouts || healthConnectWorkouts.length === 0) {
      console.log('No workouts found in Health Connect');
      result.success = true;
      result.synced = 0;
      result.skipped = 0;
      
      // Still update device lastSync even if no workouts
      await updateDeviceLastSync(userId, deviceId);
      return result;
    }

    console.log(`Found ${healthConnectWorkouts.length} workouts in Health Connect`);

    // Step 4: Fetch existing logs from backend
    console.log('Step 4: Fetching existing activity logs from backend...');
    const existingLogs = await getActivityLogs(userId);
    console.log(`Found ${existingLogs.length || 0} existing logs in backend`);

    // Step 5: Deduplicate (loads tombstones first so deleted HC workouts
    // are not re-imported on every sync)
    console.log('Step 5: Deduplicating workouts...');
    await loadHcTombstones();
    const { new: newWorkouts, duplicates, tombstoned } = deduplicateWorkouts(
      healthConnectWorkouts,
      existingLogs || []
    );

    result.skipped = duplicates.length + tombstoned.length;
    console.log(`${newWorkouts.length} new workouts to sync, ${duplicates.length} duplicates, ${tombstoned.length} tombstoned`);

    // Step 6: Post new workouts to backend
    console.log('Step 6: Posting new workouts to backend...');
    for (const workout of newWorkouts) {
      // Add userId to each workout
      workout.userID = userId;

      const postResult = await postWorkout(workout);
      
      if (postResult.success) {
        result.synced++;
        result.workouts.push(postResult.data);
        console.log('✓ Posted workout:', workout.startTime);
      } else {
        result.errors.push({
          workout: workout.startTime,
          error: postResult.error,
        });
        console.error('✗ Failed to post workout:', workout.startTime, postResult.error);
      }
    }

    // Step 7: Update device lastSync timestamp
    console.log('Step 7: Updating device last sync timestamp...');
    const deviceUpdateSuccess = await updateDeviceLastSync(userId, deviceId);
    
    if (!deviceUpdateSuccess) {
      result.errors.push({
        step: 'updateDeviceLastSync',
        error: 'Failed to update device sync timestamp',
      });
      console.warn('Warning: Failed to update device lastSync');
    }

    result.success = true;
    console.log('✓ Sync completed successfully');
    console.log('Summary:', {
      synced: result.synced,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    console.error('Sync failed:', error);
    result.success = false;
    result.errors.push({
      step: 'general',
      error: error.message || 'Sync failed',
    });

    return result;
  }
};

/**
 * Fetch new workouts from Health Connect without syncing to backend.
 * Useful for preview or manual review before sync.
 * 
 * @param {number} lookbackDays - Number of days to fetch
 * @returns {Promise<Array>} Array of structured workouts
 */
export const getNewWorkoutsPreview = async (lookbackDays = 7) => {
  try {
    const { startDate, endDate } = getDateRangeForDays(lookbackDays);
    const workouts = await getStructuredWorkouts(startDate, endDate);
    return workouts || [];
  } catch (error) {
    console.error('Error getting workouts preview:', error);
    throw error;
  }
};

/**
 * Clear old activity logs (for testing or data cleanup).
 * ⚠️ Use with caution - this is destructive.
 * 
 * NOT IMPLEMENTED - kept for documentation purposes.
 * Backend has its own data retention policies.
 */
export const clearOldLogs = async () => {
  console.warn('clearOldLogs not implemented - use backend admin tools');
};

export default {
  syncWorkoutsToBackend,
  getNewWorkoutsPreview,
};
