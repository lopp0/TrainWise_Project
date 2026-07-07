/**
 * HealthConnectService
 *
 * Wrapper around the Health Connect API for Android.
 * Handles permissions, data fetching, and transformation of workout data.
 *
 * Health Connect Exercise Types Mapping:
 * - 56 -> RUNNING (activityTypeID: 1)
 * - 79 -> WALKING (activityTypeID: 2)
 * - 8  -> BIKING  (activityTypeID: 3)
 * - 80 -> WEIGHTLIFTING (activityTypeID: 4)
 * - Other -> Default (activityTypeID: 5)
 *
 * HOW THE GUARD WORKS
 * -------------------
 * react-native-health-connect's NativeHealthConnect.js calls
 * TurboModuleRegistry.getEnforcing('HealthConnect') at module load time.
 * In Expo Go that module is not registered, so the call throws a plain
 * JavaScript Error.
 *
 * We catch that error here and transparently fall back to the mock so the
 * app runs in Expo Go without crashing.  In a real Android build the
 * require succeeds and the real implementation is used.
 *
 * WHY CommonJS (require/module.exports) AND NOT ES MODULE IMPORTS
 * ---------------------------------------------------------------
 * ES module `import` statements are hoisted by Babel/Metro and evaluated
 * before any runtime code runs.  That makes a runtime conditional guard
 * impossible.  Using require() keeps the load lazy and catchable.
 */

// --------------------------------------------------------------------------
// Attempt to load the native module.
// TurboModuleRegistry.getEnforcing throws a catchable JS Error in Expo Go.
// --------------------------------------------------------------------------
let _hc = null;
try {
  _hc = require('react-native-health-connect');
} catch (_e) {
  // Native Health Connect module is not available (Expo Go, web, etc.)
  // _hc stays null and we fall through to the mock export below.
}

if (_hc === null) {
  // ── Expo Go / web / any environment without the native module ──────────
  module.exports = require('./HealthConnectService.mock.js');
} else {
  // ── Real native build ──────────────────────────────────────────────────
  const {
    initialize,
    requestPermission,
    readRecords,
    requestExerciseRoute,
    getSdkStatus,
    getGrantedPermissions,
    SdkAvailabilityStatus,
  } = _hc;

  const EXERCISE_TYPE_MAPPING = {
    56: 1, // RUNNING
    79: 2, // WALKING
    8: 3,  // BIKING
    80: 4, // WEIGHTLIFTING / STRENGTH
  };

  const DEFAULT_ACTIVITY_TYPE_ID = 5;

  // react-native-health-connect v3+ permission objects.
  // recordType strings are case-sensitive and must match the library's types.
  // ActiveCaloriesBurned is the workout-only kcal (matches Samsung Fit's
  // "Calories entrainement" reading). TotalCaloriesBurned includes BMR and
  // would inflate workout calories ~3-7x for short sessions, which is why
  // we keep both: prefer Active, fall back to Total only when Active is
  // missing. The manifest must also list both READ_* permissions.
  const REQUIRED_PERMISSIONS = [
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'read', recordType: 'HeartRate' },
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    { accessType: 'read', recordType: 'TotalCaloriesBurned' },
    { accessType: 'read', recordType: 'Steps' },
  ];

  const SDK_AVAILABLE =
    (SdkAvailabilityStatus && SdkAvailabilityStatus.SDK_AVAILABLE) ?? 3;

  const initializeHealthConnect = async () => {
    try {
      const status = await getSdkStatus();
      console.log('[HC] getSdkStatus ->', status, '(expected', SDK_AVAILABLE, ')');
      if (status !== SDK_AVAILABLE) {
        console.warn('[HC] SDK not available on this device');
        return false;
      }
      const initialized = await initialize();
      console.log('[HC] initialize ->', initialized);
      return initialized === true;
    } catch (error) {
      console.error('[HC] initializeHealthConnect error:', error);
      return false;
    }
  };

  const requestPermissions = async () => {
    try {
      console.log('[HC] requestPermission with:', REQUIRED_PERMISSIONS);
      const grantedPermissions = await requestPermission(REQUIRED_PERMISSIONS);
      console.log('[HC] grantedPermissions ->', grantedPermissions);
      return { granted: grantedPermissions || [], permissions: REQUIRED_PERMISSIONS };
    } catch (error) {
      console.error('[HC] requestPermission threw:', error);
      throw error;
    }
  };

  const checkPermissions = async () => {
    try {
      // The HC SDK requires initialize() before any other call. If a caller
      // probes permissions before requestPermissions() has run, the call
      // throws ClientNotInitialized — initialize lazily here.
      await initializeHealthConnect();
      const grantedPermissions = await getGrantedPermissions();
      return { granted: grantedPermissions || [], permissions: REQUIRED_PERMISSIONS };
    } catch (error) {
      console.error('[HC] getGrantedPermissions threw:', error);
      return { granted: [], permissions: REQUIRED_PERMISSIONS };
    }
  };

  const hasAllPermissions = async () => {
    try {
      const { granted } = await checkPermissions();
      return REQUIRED_PERMISSIONS.every((req) =>
        granted.some(
          (g) => g.recordType === req.recordType && g.accessType === req.accessType
        )
      );
    } catch (error) {
      console.error('[HC] hasAllPermissions error:', error);
      return false;
    }
  };

  /**
   * Fetch exercise/workout sessions for a date range.
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Array>}
   */
  const fetchWorkoutSessions = async (startDate, endDate) => {
    try {
      const result = await readRecords('ExerciseSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      });
      // v3.x returns { records, pageToken }; older versions returned an array.
      const sessions = Array.isArray(result) ? result : result?.records || [];
      console.log('[HC] Fetched exercise sessions count:', sessions.length);
      return sessions;
    } catch (error) {
      console.log('[HC] fetchWorkoutSessions failed:', error?.message || error);
      throw new Error('Failed to fetch workout sessions');
    }
  };

  /**
   * Fetch step count for a specific time range.
   * @param {Date|string} startTime
   * @param {Date|string} endTime
   * @returns {Promise<number>}
   */
  const fetchStepsForSession = async (startTime, endTime) => {
    try {
      const startISO = typeof startTime === 'string' ? startTime : startTime.toISOString();
      const endISO = typeof endTime === 'string' ? endTime : endTime.toISOString();
      const result = await readRecords('Steps', {
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      const steps = Array.isArray(result) ? result : result?.records || [];
      return steps.reduce((sum, record) => sum + (record.count || 0), 0);
    } catch (error) {
      console.error('Error fetching steps:', error);
      return 0;
    }
  };

  /**
   * Fetch heart rate data for a time range.
   * @param {Date|string} startTime
   * @param {Date|string} endTime
   * @returns {Promise<{ avgHeartRate: number, maxHeartRate: number }>}
   */
  const fetchHeartRateForSession = async (startTime, endTime) => {
    try {
      const startISO = typeof startTime === 'string' ? startTime : startTime.toISOString();
      const endISO = typeof endTime === 'string' ? endTime : endTime.toISOString();
      const hrResult = await readRecords('HeartRate', {
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      const heartRateData = Array.isArray(hrResult) ? hrResult : hrResult?.records || [];
      if (!heartRateData || heartRateData.length === 0) {
        return { avgHeartRate: 0, maxHeartRate: 0 };
      }
      const bpmValues = heartRateData
        .flatMap((record) => record.samples || [])
        .map((sample) => sample.beatsPerMinute || 0)
        .filter((bpm) => bpm > 0);
      if (bpmValues.length === 0) {
        return { avgHeartRate: 0, maxHeartRate: 0 };
      }
      const avgHeartRate = Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length);
      const maxHeartRate = Math.max(...bpmValues);
      return { avgHeartRate, maxHeartRate };
    } catch (error) {
      console.error('Error fetching heart rate:', error);
      return { avgHeartRate: 0, maxHeartRate: 0 };
    }
  };

  /**
   * Fetch active calories burned in a time range (workout calories only,
   * BMR excluded). Falls back to TotalCaloriesBurned only if Active is
   * absent on the device, then subtracts an estimated BMR for the window.
   * @param {Date|string} startTime
   * @param {Date|string} endTime
   * @returns {Promise<number>}
   */
  const fetchCaloriesForSession = async (startTime, endTime) => {
    const startISO = typeof startTime === 'string' ? startTime : startTime.toISOString();
    const endISO = typeof endTime === 'string' ? endTime : endTime.toISOString();
    const sumKcal = (records) =>
      records.reduce((sum, r) => {
        const kcal =
          r.energy?.inKilocalories ??
          (r.energy?.inCalories ? r.energy.inCalories / 1000 : 0);
        return sum + kcal;
      }, 0);

    try {
      const activeResult = await readRecords('ActiveCaloriesBurned', {
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      const activeData = Array.isArray(activeResult) ? activeResult : activeResult?.records || [];
      if (activeData.length > 0) {
        return sumKcal(activeData);
      }
    } catch (error) {
      console.log('[HC] ActiveCaloriesBurned unavailable, falling back to Total:', error?.message || error);
    }

    try {
      const totalResult = await readRecords('TotalCaloriesBurned', {
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      const totalData = Array.isArray(totalResult) ? totalResult : totalResult?.records || [];
      const totalKcal = sumKcal(totalData);
      // Subtract estimated BMR for the window — assumes ~70 kcal/hr resting
      // baseline for an average adult. Prevents runaway 1500+ kcal readings
      // on short workouts when only Total is available.
      const minutes = (new Date(endISO) - new Date(startISO)) / 60000;
      const bmrKcal = (minutes / 60) * 70;
      return Math.max(0, totalKcal - bmrKcal);
    } catch (error) {
      console.error('Error fetching calories:', error);
      return 0;
    }
  };

  /**
   * Fetch distance traveled in a time range (in kilometers).
   * @param {Date|string} startTime
   * @param {Date|string} endTime
   * @returns {Promise<number>}
   */
  const fetchDistanceForSession = async (startTime, endTime) => {
    try {
      const startISO = typeof startTime === 'string' ? startTime : startTime.toISOString();
      const endISO = typeof endTime === 'string' ? endTime : endTime.toISOString();
      const distResult = await readRecords('Distance', {
        timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
      });
      const distanceData = Array.isArray(distResult) ? distResult : distResult?.records || [];
      const totalMeters = distanceData.reduce(
        (sum, record) => sum + (record.distance?.inMeters || 0),
        0
      );
      return totalMeters / 1000;
    } catch (error) {
      console.error('Error fetching distance:', error);
      return 0;
    }
  };

  /**
   * Resolve the GPS route for a single exercise session.
   *
   * Routes are NOT gated by any declared manifest permission. There is no
   * `READ_EXERCISE_ROUTE` health permission in Android (the only route
   * permission is the privileged plural `READ_EXERCISE_ROUTES`, which this
   * library doesn't support). Instead, reading another app's route uses a
   * per-record CONSENT flow via `requestExerciseRoute(recordId)`. Declaring a
   * bogus `READ_EXERCISE_ROUTE` permission makes Health Connect drop the app
   * from its permissions list on Android 14+/16 — do NOT add it back.
   * When reading a session, `exerciseRoute.type` tells us the state:
   *   - DATA            -> the route is inline on the session, use it directly
   *   - CONSENT_REQUIRED -> call requestExerciseRoute(recordId) to prompt the
   *                         user and fetch it
   *   - NO_DATA / absent -> the source app didn't record GPS (manual log,
   *                         indoor workout, gym session) -> no route
   *
   * @param {object} session - an ExerciseSession record from readRecords
   * @returns {Promise<{ points: Array<{latitude:number,longitude:number}>, status: string }>}
   *   status is one of 'data' | 'consent_required' | 'no_data' | 'unavailable'
   */
  const resolveExerciseRoute = async (session) => {
    try {
      const inline = session?.exerciseRoute;
      const ROUTE_DATA = 0;       // ExerciseRouteResultType.DATA
      const ROUTE_NO_DATA = 1;    // ExerciseRouteResultType.NO_DATA
      const ROUTE_CONSENT = 2;    // ExerciseRouteResultType.CONSENT_REQUIRED

      const normalize = (route) =>
        (route || [])
          .filter((p) => typeof p?.latitude === 'number' && typeof p?.longitude === 'number')
          .map((p) => ({ latitude: p.latitude, longitude: p.longitude }));

      // Case 1: route is inline on the session.
      if (inline?.type === ROUTE_DATA && Array.isArray(inline.route)) {
        return { points: normalize(inline.route), status: 'data' };
      }

      // Case 2: source recorded GPS but Android requires per-read consent.
      if (inline?.type === ROUTE_CONSENT) {
        const recordId = session?.metadata?.id;
        if (!recordId || typeof requestExerciseRoute !== 'function') {
          return { points: [], status: 'consent_required' };
        }
        try {
          const fetched = await requestExerciseRoute(recordId);
          const points = normalize(fetched?.route);
          return { points, status: points.length > 0 ? 'data' : 'no_data' };
        } catch (consentErr) {
          // User denied the consent prompt, or the route was deleted.
          console.log('[HC] requestExerciseRoute denied/failed:', consentErr?.message || consentErr);
          return { points: [], status: 'consent_required' };
        }
      }

      // Case 3: explicit NO_DATA, or no route field at all (manual / indoor).
      if (inline?.type === ROUTE_NO_DATA || inline == null) {
        return { points: [], status: 'no_data' };
      }

      // Defensive: some sources populate `route` without a `type`.
      if (Array.isArray(inline?.route)) {
        return { points: normalize(inline.route), status: 'data' };
      }
      return { points: [], status: 'no_data' };
    } catch (error) {
      console.log('[HC] resolveExerciseRoute failed:', error?.message || error);
      return { points: [], status: 'unavailable' };
    }
  };

  /**
   * Fetch the GPS route for a workout identified by its time range.
   *
   * Used by WorkoutRouteScreen with the "pull-from-HC-on-view" strategy:
   * backend ActivityLog rows don't carry the HC record id, so we re-query
   * HC for the session matching the workout's startTime, then resolve its
   * route. Only HC-sourced workouts can match; manual logs return no_data.
   *
   * @param {Date|string} startTime
   * @param {Date|string} endTime
   * @returns {Promise<{ points: Array<{latitude:number,longitude:number}>, status: string }>}
   */
  const fetchRouteForWorkout = async (startTime, endTime) => {
    try {
      const ready = await initializeHealthConnect();
      if (!ready) return { points: [], status: 'unavailable' };

      const start = new Date(startTime);
      const end = new Date(endTime);
      // Widen the window slightly so minute-rounded backend times still match
      // the HC session (which may carry seconds).
      const windowStart = new Date(start.getTime() - 5 * 60 * 1000);
      const windowEnd = new Date(end.getTime() + 5 * 60 * 1000);

      const sessions = await fetchWorkoutSessions(windowStart, windowEnd);
      if (!sessions || sessions.length === 0) {
        return { points: [], status: 'no_data' };
      }

      // Pick the session whose startTime is closest to the requested one.
      const target = sessions.reduce((best, s) => {
        const diff = Math.abs(new Date(s.startTime) - start);
        if (!best || diff < best.diff) return { session: s, diff };
        return best;
      }, null);

      if (!target?.session) return { points: [], status: 'no_data' };
      return await resolveExerciseRoute(target.session);
    } catch (error) {
      console.log('[HC] fetchRouteForWorkout failed:', error?.message || error);
      return { points: [], status: 'unavailable' };
    }
  };

  const mapExerciseType = (exerciseType) =>
    EXERCISE_TYPE_MAPPING[exerciseType] || DEFAULT_ACTIVITY_TYPE_ID;

  const calculateDuration = (startTime, endTime) =>
    Math.round((new Date(endTime) - new Date(startTime)) / (1000 * 60));

  /**
   * Fetch structured workout data for a date range.
   * Master function that combines all data sources.
   * Self-initializes Health Connect and checks permissions so callers don't
   * need to. Returns [] silently when HC is unavailable or not granted —
   * avoids throwing ClientNotInitialized / permission errors to the UI.
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Array>}
   */
  const getStructuredWorkouts = async (startDate, endDate) => {
    try {
      const ready = await initializeHealthConnect();
      if (!ready) {
        console.log('[HC] SDK not ready, returning empty workout list');
        return [];
      }
      const granted = await hasAllPermissions();
      if (!granted) {
        console.log('[HC] Required permissions not granted, returning empty workout list');
        return [];
      }
      console.log(`Fetching structured workouts from ${startDate} to ${endDate}`);
      const sessions = await fetchWorkoutSessions(startDate, endDate);
      if (!sessions || sessions.length === 0) {
        console.log('No workout sessions found');
        return [];
      }
      const structuredWorkouts = await Promise.all(
        sessions.map(async (session) => {
          try {
            const startTime = session.startTime || new Date(0);
            const endTime = session.endTime || new Date();
            const [heartRateData, caloriesData, distanceData] = await Promise.all([
              fetchHeartRateForSession(startTime, endTime),
              fetchCaloriesForSession(startTime, endTime),
              fetchDistanceForSession(startTime, endTime),
            ]);
            return {
              userID: null,
              activityTypeID: mapExerciseType(session.exerciseType),
              startTime: new Date(startTime).toISOString(),
              endTime: new Date(endTime).toISOString(),
              distanceKM: Math.round(distanceData * 100) / 100,
              avgHeartRate: heartRateData.avgHeartRate,
              maxHeartRate: heartRateData.maxHeartRate,
              caloriesBurned: Math.round(caloriesData * 10) / 10,
              sourceDevice: 'Health Connect',
              exertionLevel: 5,
              duration: calculateDuration(startTime, endTime),
              isConfirmed: false,
            };
          } catch (error) {
            console.error('Error processing session', session.startTime, 'Error:', error);
            return null;
          }
        })
      );
      const validWorkouts = structuredWorkouts.filter((w) => w !== null);
      console.log(`Processed ${validWorkouts.length} valid workouts`);
      return validWorkouts;
    } catch (error) {
      console.log('[HC] getStructuredWorkouts failed, returning empty list:', error?.message || error);
      return [];
    }
  };

  module.exports = {
    initializeHealthConnect,
    requestPermissions,
    checkPermissions,
    hasAllPermissions,
    fetchWorkoutSessions,
    fetchStepsForSession,
    fetchHeartRateForSession,
    fetchCaloriesForSession,
    fetchDistanceForSession,
    fetchRouteForWorkout,
    resolveExerciseRoute,
    getStructuredWorkouts,
    default: {
      initializeHealthConnect,
      requestPermissions,
      checkPermissions,
      hasAllPermissions,
      fetchWorkoutSessions,
      fetchStepsForSession,
      fetchHeartRateForSession,
      fetchCaloriesForSession,
      fetchDistanceForSession,
      fetchRouteForWorkout,
      resolveExerciseRoute,
      getStructuredWorkouts,
    },
  };
}
