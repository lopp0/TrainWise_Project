/**
 * HealthConnectService.mock.js
 *
 * Mock implementation of HealthConnectService for use in Expo Go and web,
 * where the native react-native-health-connect module is unavailable.
 * All functions return safe empty/default values without calling any native API.
 *
 * Written as pure CommonJS so it can be safely require()'d from
 * HealthConnectService.js which is also CommonJS.
 */

const initializeHealthConnect = async () => {
  return false;
};

const requestPermissions = async () => {
  return { granted: [], permissions: [] };
};

const checkPermissions = async () => {
  return { granted: [], permissions: [] };
};

const hasAllPermissions = async () => {
  return false;
};

const fetchWorkoutSessions = async (_startDate, _endDate) => {
  return [];
};

const fetchStepsForSession = async (_startTime, _endTime) => {
  return 0;
};

const fetchHeartRateForSession = async (_startTime, _endTime) => {
  return { avgHeartRate: 0, maxHeartRate: 0 };
};

const fetchCaloriesForSession = async (_startTime, _endTime) => {
  return 0;
};

const fetchDistanceForSession = async (_startTime, _endTime) => {
  return 0;
};

const fetchRouteForWorkout = async (_startTime, _endTime) => {
  return { points: [], status: 'unavailable' };
};

const resolveExerciseRoute = async (_session) => {
  return { points: [], status: 'unavailable' };
};

const getStructuredWorkouts = async (_startDate, _endDate) => {
  return [];
};

// #129/#130 — readiness stubs (no data in Expo Go / web).
const requestReadinessPermissions = async () => ({ granted: [] });
const fetchSleepLastNight = async () => null;
const fetchRestingHeartRate = async () => null;
const fetchHrv = async () => null;

const api = {
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
  requestReadinessPermissions,
  fetchSleepLastNight,
  fetchRestingHeartRate,
  fetchHrv,
};

module.exports = { ...api, default: api };
