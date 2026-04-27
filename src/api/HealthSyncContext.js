import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import useSyncWorkouts from './useSyncWorkouts';
import { getActivityLogs } from './api';

const HealthSyncContext = createContext(null);

const AUTOSYNC_THROTTLE_MS = 30_000;

export const HealthSyncProvider = ({ children }) => {
  const { userId } = useAuth();
  const {
    triggerSync,
    permissionsGranted,
    checkHCPermissions,
    requestHCPermissions,
    isSyncing,
    error,
  } = useSyncWorkouts();

  const [unconfirmedCount, setUnconfirmedCount] = useState(0);
  const lastAutoSyncRef = useRef(0);

  const refreshUnconfirmedCount = useCallback(async () => {
    if (!userId) {
      setUnconfirmedCount(0);
      return;
    }
    try {
      const logs = await getActivityLogs(userId);
      const count = (logs || []).filter((w) => !w.isConfirmed).length;
      setUnconfirmedCount(count);
    } catch (e) {
      console.warn('[HealthSync] count refresh failed:', e.message);
    }
  }, [userId]);

  const runAutoSync = useCallback(async () => {
    if (!userId) return;
    const now = Date.now();
    const stale = now - lastAutoSyncRef.current >= AUTOSYNC_THROTTLE_MS;
    lastAutoSyncRef.current = now;

    try {
      const granted = await checkHCPermissions();
      if (granted && stale) {
        await triggerSync(7);
      }
    } catch (e) {
      console.warn('[HealthSync] auto-sync failed:', e.message);
    } finally {
      await refreshUnconfirmedCount();
    }
  }, [userId, checkHCPermissions, triggerSync, refreshUnconfirmedCount]);

  // Run once when the user becomes known (app open / login).
  useEffect(() => {
    if (userId) {
      lastAutoSyncRef.current = 0; // force a sync on first run
      runAutoSync();
    } else {
      setUnconfirmedCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Re-run when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userId) runAutoSync();
    });
    return () => sub.remove();
  }, [userId, runAutoSync]);

  return (
    <HealthSyncContext.Provider
      value={{
        permissionsGranted,
        unconfirmedCount,
        isSyncing,
        lastSyncError: error,
        runAutoSync,
        refreshUnconfirmedCount,
        requestHCPermissions,
      }}
    >
      {children}
    </HealthSyncContext.Provider>
  );
};

export const useHealthSync = () => {
  const ctx = useContext(HealthSyncContext);
  if (!ctx) {
    throw new Error('useHealthSync must be used inside HealthSyncProvider');
  }
  return ctx;
};
