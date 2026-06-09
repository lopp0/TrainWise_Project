import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import useSyncWorkouts from './useSyncWorkouts';
import { getActivityLogs } from './api';
import { scopedKey } from '../utils/activeUser';
import { HC_CONNECTED_BASE } from '../constants/hcKeys';

const HealthSyncContext = createContext(null);

const AUTOSYNC_THROTTLE_MS = 30_000;

// Per-account opt-in. Health Connect permission is device-level (shared by every
// account on the phone), so without this every account would auto-import the
// same device workouts. The stored value is the ISO timestamp the account
// connected — its presence = "connected", and SyncService uses it as the import
// floor so only workouts done AFTER connecting are pulled in.
const readAccountConnectedAt = async () => {
  try {
    const v = await AsyncStorage.getItem(scopedKey(HC_CONNECTED_BASE));
    const t = v ? Date.parse(v) : NaN;
    return Number.isNaN(t) ? null : new Date(t);
  } catch {
    return null;
  }
};
const readAccountConnected = async () => (await readAccountConnectedAt()) != null;

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
  // Whether THIS account has opted into Health Connect (drives the UI's
  // Connected/Not-Connected state and the pink Connect button).
  const [accountConnected, setAccountConnected] = useState(false);
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
      // Quiet on network errors — these are expected when the dev backend
      // hasn't started yet. The next foreground re-runs the count fetch.
      const isNetwork = /network|timeout|econn|fetch/i.test(e.message || '');
      if (!isNetwork) console.warn('[HealthSync] count refresh failed:', e.message);
    }
  }, [userId]);

  const runAutoSync = useCallback(async (force = false) => {
    if (!userId) return;
    // Only sync if THIS account opted into HC. Prevents a new account from
    // silently inheriting the device's HC workouts.
    if (!(await readAccountConnected())) {
      await refreshUnconfirmedCount();
      return;
    }
    const now = Date.now();
    const stale = now - lastAutoSyncRef.current >= AUTOSYNC_THROTTLE_MS;
    lastAutoSyncRef.current = now;

    try {
      const granted = await checkHCPermissions();
      // `force` (manual pull-to-refresh) bypasses the 30s throttle so a just-
      // finished HC workout imports immediately instead of waiting it out.
      if (granted && (stale || force)) {
        const result = await triggerSync(7);
        // If the sync failed because the backend was unreachable, reset
        // the throttle so the NEXT foreground (or the retry below) tries
        // again immediately instead of waiting 30s.
        const firstErr = result?.errors?.[0]?.error || '';
        const isNetwork = /network|timeout|econn|fetch/i.test(firstErr);
        if (!result?.success && isNetwork) {
          lastAutoSyncRef.current = 0;
          // One opportunistic retry after 4s — covers the common case
          // where the backend was just slow to accept the first request
          // (cold start, adb reverse re-attached, etc).
          setTimeout(() => {
            if (lastAutoSyncRef.current === 0) runAutoSync();
          }, 4000);
        }
      }
    } catch (e) {
      const isNetwork = /network|timeout|econn|fetch/i.test(e.message || '');
      if (!isNetwork) console.warn('[HealthSync] auto-sync failed:', e.message);
    } finally {
      await refreshUnconfirmedCount();
    }
  }, [userId, checkHCPermissions, triggerSync, refreshUnconfirmedCount]);

  // Opt this account into Health Connect: request the device permission, then
  // persist the per-account flag and run the first sync. Called by the pink
  // "Connect Health Connect" button.
  const connectThisAccount = useCallback(async () => {
    const granted = await requestHCPermissions();
    if (granted) {
      try {
        // Store the connect moment — also used as the HC import floor.
        await AsyncStorage.setItem(scopedKey(HC_CONNECTED_BASE), new Date().toISOString());
      } catch {
        // non-fatal — worst case the user re-taps Connect next launch
      }
      setAccountConnected(true);
      lastAutoSyncRef.current = 0; // force an immediate sync
      await runAutoSync();
    }
    return granted;
  }, [requestHCPermissions, runAutoSync]);

  // Run once when the user becomes known (app open / login). Loads the
  // per-account HC flag first so the UI shows the right Connected state.
  useEffect(() => {
    if (userId) {
      lastAutoSyncRef.current = 0; // force a sync on first run
      (async () => {
        setAccountConnected(await readAccountConnected());
        runAutoSync();
      })();
    } else {
      setUnconfirmedCount(0);
      setAccountConnected(false);
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
        // Per-account connected state (not the raw device permission), so each
        // account shows its own Connected / Not-Connected status.
        permissionsGranted: accountConnected,
        devicePermissionsGranted: permissionsGranted,
        unconfirmedCount,
        isSyncing,
        lastSyncError: error,
        runAutoSync,
        refreshUnconfirmedCount,
        requestHCPermissions,
        connectThisAccount,
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
