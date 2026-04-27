import axios from 'axios';

// Reaches the PC backend via `adb reverse tcp:5249 tcp:5249` over USB.
// The phone treats 127.0.0.1:5249 as itself; adb forwards that to the PC.
// Reliable across WiFi drops because it uses the USB cable. If you ever go
// wireless, swap this for the PC's LAN IP (e.g. http://192.168.1.117:5249/api).
const API_BASE_URL = 'http://127.0.0.1:5249/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== USERS ====================
export const getUserById = (userId) =>
  api.get(`/users/${userId}`);

export const updateUser = (userId, data) =>
  api.put(`/users/${userId}`, data);

export const updateProfileImage = (userId, imagePath) =>
  api.put(`/users/${userId}/profile-image`, { profileImagePath: imagePath });

// ==================== ACTIVITY TYPES ====================
export const getAllActivityTypes = () =>
  api.get('/activitytype');

// ==================== ACTIVITY LOGS ====================
export const createActivityLog = (data) =>
  api.post('/activitylog', data);

export const getActivityLogsByUser = (userId) =>
  api.get(`/activitylog/user/${userId}`);

export const deleteActivityLog = (activityId) =>
  api.delete(`/activitylog/${activityId}`);

// ==================== DAILY LOAD ====================
export const getDailyLoadByUser = (userId) =>
  api.get(`/dailyload/user/${userId}`);

export const calculateDailyLoad = (userId, date = new Date()) =>
  api.post(`/dailyload/user/${userId}/calculate`, {
    date: date instanceof Date ? date.toISOString() : date,
  });

// ==================== RECOMMENDATIONS ====================
export const getRecommendationsByUser = (userId) =>
  api.get(`/recommendation/user/${userId}`);

export const getCoachRecommendationsByUser = (userId) =>
  api.get(`/coachrecommendations/user/${userId}`);

// ==================== INJURIES ====================
export const getAllInjuryTypes = () =>
  api.get('/injurytypes');

export const createInjuryReport = (data) =>
  api.post('/injuryreport', data);

export const getInjuriesByUser = (userId) =>
  api.get(`/injuryreport/user/${userId}`);

export const getActiveInjuriesByUser = (userId) =>
  api.get(`/injuryreport/user/${userId}/active`);

export const markInjuryRecovered = (injuryId) =>
  api.put(`/injuryreport/${injuryId}/recover`);

// ==================== COACH ====================
export const getCoachById = (coachId) =>
  api.get(`/coach/${coachId}`);

export const getTraineesByCoach = (coachId) =>
  api.get(`/coach/${coachId}/trainees`);

// ==================== GOALS & PREFERENCES ====================
export const getAllTrainingGoals = () =>
  api.get('/traininggoals');

export const addUserTrainingGoal = (userId, goalId) =>
  api.post('/usertraininggoals', { userId, goalId });

export const removeUserTrainingGoal = (userId, goalId) =>
  api.delete(`/usertraininggoals/${userId}/${goalId}`);

export const addUserActivityPreference = (userId, activityTypeId) =>
  api.post('/useractivitypreferences', { userId, activityTypeId });

export const removeUserActivityPreference = (userId, activityTypeId) =>
  api.delete(`/useractivitypreferences/${userId}/${activityTypeId}`);

// ==================== DEVICES ====================
export const getUserDevices = (userId) =>
  api.get(`/userdevice/user/${userId}`);

export const registerDevice = (data) =>
  api.post('/userdevice', data);

export default api;
