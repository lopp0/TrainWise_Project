import { useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { syncWorkoutsToBackend } from './SyncService';
import {
  requestPermissions,
  checkPermissions,
  initializeHealthConnect,
} from './HealthConnectService';

const REQUIRED_PERM_COUNT = 5;

const classifyPermissionError = (err) => {
  const msg = (err && err.message) || '';
  if (/not available|SDK|unavailable/i.test(msg)) {
    return 'Health Connect is not available on this device.';
  }
  if (/denied|revoked|rejected/i.test(msg)) {
    return 'Permissions were denied. Please grant them in Health Connect settings.';
  }
  return 'Could not open Health Connect. Please make sure it is installed and up to date.';
};

/**
 * useSyncWorkouts
 * 
 * Custom hook that wraps SyncService and Health Connect operations.
 * Manages sync state, loading, errors, and provides a convenient interface.
 * 
 * @example
 * const { isSyncing, lastSyncTime, syncResult, error, triggerSync, requestHCPermissions } = useSyncWorkouts();
 * 
 * // Request permissions first
 * await requestHCPermissions();
 * 
 * // Then trigger sync
 * await triggerSync();
 */
export const useSyncWorkouts = () => {
  const { userId, deviceId } = useAuth();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  
  // Track sync attempts for retry logic if needed
  const syncAttempts = useRef(0);

  /**
   * Request Health Connect permissions.
   * Shows the permission dialog to the user.
   * 
   * @returns {Promise<boolean>} true if permissions granted
   */
  const requestHCPermissions = useCallback(async () => {
    try {
      setError(null);
      console.log('[useSyncWorkouts] step 1: initializeHealthConnect');
      const isAvailable = await initializeHealthConnect();
      if (!isAvailable) {
        setError('Health Connect is not available on this device.');
        setPermissionsGranted(false);
        return false;
      }

      console.log('[useSyncWorkouts] step 2: requestPermissions');
      const permResult = await requestPermissions();
      console.log('[useSyncWorkouts] step 3: granted =', permResult.granted);

      const allGranted =
        Array.isArray(permResult.granted) &&
        permResult.granted.length >= REQUIRED_PERM_COUNT;
      setPermissionsGranted(allGranted);

      if (!allGranted) {
        setError('Permissions were denied. Please grant them in Health Connect settings.');
        return false;
      }

      console.log('[useSyncWorkouts] ✓ all permissions granted');
      return true;
    } catch (err) {
      console.error('[useSyncWorkouts] requestHCPermissions error:', err);
      setError(classifyPermissionError(err));
      setPermissionsGranted(false);
      return false;
    }
  }, []);

  /**
   * Check if Health Connect permissions are already granted.
   * 
   * @returns {Promise<boolean>} true if all permissions granted
   */
  const checkHCPermissions = useCallback(async () => {
    try {
      const permStatus = await checkPermissions();
      const allGranted = permStatus.granted.length >= 5;
      setPermissionsGranted(allGranted);
      return allGranted;
    } catch (err) {
      console.error('Error checking permissions:', err);
      setPermissionsGranted(false);
      return false;
    }
  }, []);

  /**
   * Trigger the sync process.
   * Requires userId and deviceId from AuthContext.
   * 
   * @param {number} lookbackDays - Optional: number of days to sync (default 7)
   * @returns {Promise<Object>} Sync result
   * @throws {Error} If userId or deviceId not available
   */
  const triggerSync = useCallback(
    async (lookbackDays = 7) => {
      try {
        if (!userId || !deviceId) {
          throw new Error(
            'User ID or Device ID not available. Please ensure user is logged in.'
          );
        }

        setIsSyncing(true);
        setError(null);
        setSyncResult(null);
        syncAttempts.current += 1;

        console.log(`[Sync #${syncAttempts.current}] Starting sync...`);

        const result = await syncWorkoutsToBackend(userId, deviceId, lookbackDays);

        setSyncResult(result);
        
        if (result.success) {
          setLastSyncTime(new Date());
          console.log(`✓ Sync successful: ${result.synced} workouts synced`);
        } else {
          const errorMsg =
            result.errors?.[0]?.error || 'Sync completed with errors';
          setError(errorMsg);
          console.error('Sync failed:', errorMsg);
        }

        return result;
      } catch (err) {
        const errorMsg = err.message || 'Sync failed';
        setError(errorMsg);
        setSyncResult({
          success: false,
          synced: 0,
          skipped: 0,
          errors: [{ step: 'general', error: errorMsg }],
          workouts: [],
        });
        console.error('Sync error:', err);
        
        return {
          success: false,
          synced: 0,
          skipped: 0,
          errors: [{ step: 'general', error: errorMsg }],
          workouts: [],
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [userId, deviceId]
  );

  /**
   * Clear stored sync result and error.
   */
  const clearSyncState = useCallback(() => {
    setSyncResult(null);
    setError(null);
  }, []);

  /**
   * Reset all sync state to initial values.
   */
  const resetSync = useCallback(() => {
    setIsSyncing(false);
    setLastSyncTime(null);
    setSyncResult(null);
    setError(null);
    setPermissionsGranted(false);
    syncAttempts.current = 0;
  }, []);

  return {
    // State
    isSyncing,
    lastSyncTime,
    syncResult,
    error,
    permissionsGranted,
    syncAttempts: syncAttempts.current,
    
    // Methods
    triggerSync,
    requestHCPermissions,
    checkHCPermissions,
    clearSyncState,
    resetSync,
  };
};

export default useSyncWorkouts;
