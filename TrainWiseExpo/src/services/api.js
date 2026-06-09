import axios from 'axios';

// Local backend on the PC LAN IP. MUST stay in sync with src/api/api.js —
// if these two differ, half the app (login/profile) works while the other
// half (coach, QR connect, upload, chat) fails with "Network Error".
// The PC's DHCP lease can shift this IP; verify with `ipconfig | findstr IPv4`.
// USB / adb-reverse mode — MUST match src/api/api.js. The phone's
// 127.0.0.1:5249 is forwarded to the PC via `adb reverse tcp:5249 tcp:5249`,
// so this works on any network (incl. school WiFi that blocks device-to-device
// traffic). Requires USB + adb reverse re-run after each reconnect.
const API_BASE_URL = 'http://192.168.1.119:5249/api'; // Home LAN (wireless) — MUST match src/api/api.js. USB-anywhere alt: http://127.0.0.1:5249/api + adb reverse.

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

// Permanently deletes the user and every row referencing them. Backend
// sp_DeleteUser must clean up child tables (ActivityLogs, DailyLoad,
// CoachTrainees, Messages, etc.) inside a transaction — without that,
// the FK on ActivityLogs.UserID rejects the DELETE with Msg 547.
export const deleteUser = (userId) =>
  api.delete(`/users/${userId}`);

// Multipart upload to the backend's POST /api/users/{id}/upload endpoint
// (UsersController.UploadImage). Returns { path: "/images/{id}_{filename}" }
// which is then stored in the user's ProfileImagePath column server-side.
//
// `localUri` is an ImagePicker result URI (file://...). The backend saves
// the file under wwwroot/images so it's served by UseStaticFiles at
// `<host>/images/<file>`.
export const uploadProfileImage = async (userId, localUri) => {
  const filename = localUri.split('/').pop() || `profile_${userId}.jpg`;
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
  const mime =
    ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : 'image/jpeg';

  const form = new FormData();
  form.append('file', { uri: localUri, name: filename, type: mime });

  // Using fetch instead of axios for multipart on RN: axios on RN
  // intermittently fails to handle the multipart boundary correctly and
  // surfaces a generic "Network Error" with no HTTP status. fetch lets RN
  // construct the body natively and reports real status codes. 60s timeout
  // via AbortController so slow cellular uploads don't get killed at 15s.
  const url = `${API_BASE_URL}/users/${userId}/upload`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: form,
      // Intentionally no Content-Type header — RN sets it to
      // multipart/form-data with the proper boundary automatically.
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${text || 'no response body'}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON: ${text.slice(0, 200)}`);
  }
};

// Resolve a stored ProfileImagePath ("images/12_pic.jpg" or "/images/...")
// into a full URL the <Image> component can fetch. Strips the trailing
// "/api" from API_BASE_URL because static files are served from the host
// root, not the API prefix.
export const resolveProfileImageUrl = (profileImagePath) => {
  if (!profileImagePath) return null;
  const host = API_BASE_URL.replace(/\/api\/?$/, '');
  const path = profileImagePath.startsWith('/') ? profileImagePath : `/${profileImagePath}`;
  return `${host}${path}`;
};

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
// Resolve the logged-in user's coach profile (CoachID != UserID).
export const getCoachByUserId = (userId) =>
  api.get(`/coach/by-user/${userId}`);

export const getTraineesByCoach = (coachId) =>
  api.get(`/coach/${coachId}/trainees`);

export const getTraineeLoad = (coachId, userId) =>
  api.get(`/coach/${coachId}/trainees/${userId}/load`);

// Coach <-> trainee linking (used by the QR connect flow).
export const connectCoachTrainee = (coachId, userId) =>
  api.post(`/coachtrainee/${coachId}/connect/${userId}`, {});

export const disconnectCoachTrainee = (coachId, userId) =>
  api.delete(`/coachtrainee/${coachId}/disconnect/${userId}`);

export const createCoachRecommendation = ({ coachId, userId, title, text, date = new Date() }) =>
  api.post('/coachrecommendations', {
    coachID: coachId,
    userID: userId,
    date: date instanceof Date ? date.toISOString() : date,
    title,
    text,
  });

// Coaches a trainee is linked to (used by the trainee-side "Message coach"
// entry). Each item has { coachID, coachUserID, fullName, email, profileImagePath }.
export const getCoachesForTrainee = (userId) =>
  api.get(`/coach/for-trainee/${userId}`);

// ==================== CHAT / MESSAGES ====================
// Chat is user<->user. `senderId` / `receiverId` are both Users.UserID.
// `imagePath` (optional) is a path returned by uploadChatImage.
export const sendMessage = ({ senderId, receiverId, text, imagePath }) =>
  api.post('/messages', {
    senderID: Number(senderId),
    receiverID: Number(receiverId),
    text: text ?? '',
    imagePath: imagePath ?? null,
  });

// Uploads a chat image to the backend (multipart), returns { path } where
// path is "/images/chat_...". Send a message with that path as imagePath.
// Uses fetch (not axios) for the same RN multipart-boundary reason as
// uploadProfileImage.
export const uploadChatImage = async (localUri) => {
  const filename = localUri.split('/').pop() || `chat_${Date.now()}.jpg`;
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const form = new FormData();
  form.append('file', { uri: localUri, name: filename, type: mime });

  const url = `${API_BASE_URL}/messages/upload`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch(url, { method: 'POST', body: form, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${text || 'no response body'}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON: ${text.slice(0, 200)}`);
  }
};

// Full thread between two users (oldest first).
export const getConversation = (userA, userB) =>
  api.get(`/messages/conversation/${userA}/${userB}`);

// Mark messages FROM `senderId` TO `receiverId` as seen (call when the
// receiver opens the chat) so the sender sees double-tick read receipts.
export const markMessagesSeen = (senderId, receiverId) =>
  api.put(`/messages/seen/${senderId}/${receiverId}`);

// Unread-message count addressed to this user (chat badge).
export const getUnreadMessageCount = (userId) =>
  api.get(`/messages/unread/${userId}`);

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

// ==================== SOCIAL: PRESENCE / LOCATION (#3) ====================
// Heartbeat — marks the user online (LastSeen = now). Call periodically while
// the app is foregrounded so the green presence dot stays lit for friends.
export const heartbeat = (userId) =>
  api.put(`/social/presence/${userId}`, {});

// Push the user's current GPS so they appear on others' Connect maps.
export const updateMyLocation = (userId, latitude, longitude) =>
  api.put(`/social/location/${userId}`, { latitude, longitude });

// Users near a point (gyms + people are anchored to real coords). Excludes self.
export const getNearbyUsers = (userId, lat, lng, radiusKm = 25) =>
  api.get(`/social/nearby/${userId}`, { params: { lat, lng, radiusKm } });

// Quick-look profile shown when a pin/list row is tapped (training level,
// top-3 activities, friendship status with the viewer).
export const getUserMiniProfile = (viewerId, targetId) =>
  api.get(`/social/profile/${viewerId}/${targetId}`);

// ==================== SOCIAL: FRIENDS (#3) ====================
export const sendFriendRequest = (requesterId, addresseeId) =>
  api.post(`/social/friends/request/${requesterId}/${addresseeId}`, {});

export const respondFriendRequest = (friendshipId, accept) =>
  api.put(`/social/friends/respond/${friendshipId}/${accept}`, {});

export const getFriends = (userId) =>
  api.get(`/social/friends/${userId}`);

export const getFriendRequests = (userId) =>
  api.get(`/social/friends/requests/${userId}`);

export const removeFriend = (userA, userB) =>
  api.delete(`/social/friends/${userA}/${userB}`);

// ==================== SOCIAL: COACH OFFERS (#3) ====================
// A coach offers to coach a trainee; on accept a real CoachTrainees link forms.
export const sendCoachOffer = (coachUserId, traineeUserId) =>
  api.post(`/social/coachoffer/${coachUserId}/${traineeUserId}`, {});

export const respondCoachOffer = (offerId, accept) =>
  api.put(`/social/coachoffer/respond/${offerId}/${accept}`, {});

export const getCoachOffersForTrainee = (traineeUserId) =>
  api.get(`/social/coachoffer/trainee/${traineeUserId}`);

export const getSentCoachOffers = (coachUserId) =>
  api.get(`/social/coachoffer/sent/${coachUserId}`);

// ==================== GYMS (#3) ====================
export const getGyms = (lat, lng, radiusKm = 25) =>
  api.get('/gyms', { params: { lat, lng, radiusKm } });

export const getGymCoaches = (gymId) =>
  api.get(`/gyms/${gymId}/coaches`);

export const addCoachToGym = (gymId, coachUserId) =>
  api.post(`/gyms/${gymId}/coaches/${coachUserId}`, {});

export const removeCoachFromGym = (gymId, coachUserId) =>
  api.delete(`/gyms/${gymId}/coaches/${coachUserId}`);

export const getGymsForCoach = (coachUserId) =>
  api.get(`/gyms/for-coach/${coachUserId}`);

export default api;
