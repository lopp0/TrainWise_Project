import axios from 'axios';
import { getAuthToken } from '../api/authToken';
// Single source of truth for the backend URL — flip BACKEND_MODE in
// src/config/backend.js to switch the whole app between Local‑LAN and Azure.
import { API_BASE_URL } from '../config/backend';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the bearer token to every request when the user is logged in.
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ==================== USERS ====================
export const getUserById = (userId) =>
  api.get(`/users/${userId}`);

export const updateUser = (userId, data) =>
  api.put(`/users/${userId}`, data);

// #111 — change password (backend verifies the current one).
export const changePassword = (userId, currentPassword, newPassword) =>
  api.put(`/users/${userId}/password`, { currentPassword, newPassword });

// #131 — body-measurement tracking (weight / body-fat over time).
export const getBodyMeasurements = (userId) =>
  api.get(`/users/${userId}/measurements`);
export const addBodyMeasurement = (userId, { weight, bodyFat = null, date = new Date() }) =>
  api.post(`/users/${userId}/measurements`, {
    weight,
    bodyFat,
    date: date instanceof Date ? date.toISOString() : date,
  });

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
    const _t = getAuthToken();
    response = await fetch(url, {
      method: 'POST',
      body: form,
      // Intentionally no Content-Type header — RN sets it to
      // multipart/form-data with the proper boundary automatically.
      // Attach the bearer token manually since fetch bypasses the axios interceptor.
      headers: _t ? { Authorization: `Bearer ${_t}` } : undefined,
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

// The device's UTC offset in minutes (Israel DST = 180). JS getTimezoneOffset
// returns minutes BEHIND UTC, hence the sign flip. The backend uses it to
// bucket session times to the user's LOCAL calendar day — without it a 00:30
// workout counts on the previous day's load windows.
export const deviceTzOffsetMinutes = () => -new Date().getTimezoneOffset();

export const calculateDailyLoad = (userId, date = new Date()) =>
  api.post(`/dailyload/user/${userId}/calculate`, {
    date: date instanceof Date ? date.toISOString() : date,
    tzOffsetMinutes: deviceTzOffsetMinutes(),
  });

// Day-by-day trend series with BOTH AC-ratio methods (classic rolling + EWMA)
// plus a summary block (monotony/strain, intensity mix). Coach-readable for
// linked trainees. Falls back to utils/loadSeries when the backend predates it.
export const getLoadAnalytics = (userId, days = 56) =>
  api.get(`/dailyload/user/${userId}/analytics`, {
    // end = the DEVICE's calendar date: Azure runs on UTC, so between local
    // midnight and 03:00 the server's "today" is still yesterday.
    params: {
      days,
      end: new Date().toLocaleDateString('en-CA'),
      tzOffsetMinutes: deviceTzOffsetMinutes(),
    },
  });

// ==================== WORKOUT SHARE (#181) ====================
// Mark a workout shareable (owner only), then share the deep link.
export const shareWorkout = (activityId, shared = true) =>
  api.put(`/activitylog/${activityId}/share`, { shared });
// Anonymous read of a shared workout (non-sensitive fields only).
export const getPublicWorkout = (activityId) =>
  api.get(`/activitylog/${activityId}/public`);

// ==================== WORKOUT TEMPLATES (#119) ====================
export const getWorkoutTemplates = (userId) =>
  api.get(`/workouttemplates/user/${userId}`);
export const createWorkoutTemplate = (template) =>
  api.post('/workouttemplates', template);
export const deleteWorkoutTemplate = (templateId) =>
  api.delete(`/workouttemplates/${templateId}`);

// ==================== NUTRITION / HYDRATION (#132) ====================
// Today's entries + totals for the user's LOCAL calendar day.
export const getNutritionDay = (userId, date = new Date()) =>
  api.get(`/nutrition/user/${userId}/day`, {
    params: {
      date: (date instanceof Date ? date : new Date(date)).toLocaleDateString('en-CA'),
      tzOffsetMinutes: deviceTzOffsetMinutes(),
    },
  });
// kind = 'food' (name?/calories/barcode?) or 'water' (waterMl).
export const addNutritionEntry = (userId, entry) =>
  api.post(`/nutrition/user/${userId}`, entry);
export const deleteNutritionEntry = (entryId) =>
  api.delete(`/nutrition/${entryId}`);

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

// #127 — daily pain-level (1-10) tracking per injury, for the recovery trend.
export const getPainLogs = (injuryId) =>
  api.get(`/injuryreport/${injuryId}/pain`);
export const addPainLog = (injuryId, level, note = null) =>
  api.post(`/injuryreport/${injuryId}/pain`, { level, note });

// #124 — per-workout note + photo. The photo is uploaded via uploadChatImage
// (returns a /images path), then stored alongside the note here.
export const getWorkoutNotes = (activityId) =>
  api.get(`/activitylog/${activityId}/notes`);
export const setWorkoutNotes = (activityId, { notes = null, photoPath = null } = {}) =>
  api.put(`/activitylog/${activityId}/notes`, { notes, photoPath });

// ==================== RECORDS / BADGES (A-5) ====================
export const getRecords = (userId) => api.get(`/records/${userId}`);
// Re-evaluates records/badges after a workout; returns { records, badges, newBadges }.
export const checkRecords = (userId) => api.post(`/records/check/${userId}`);

// ==================== COSMETICS (A-1) ====================
// Persist the user's equipped cosmetics so others see them in Connect.
export const updateEquipped = (
  userId,
  { equippedBadge = null, equippedTitle = null, equippedFrame = null } = {}
) => api.put(`/users/${userId}/equip`, { equippedBadge, equippedTitle, equippedFrame });

// Batch cosmetics for a list/CSV of user ids.
export const getCosmeticsForUsers = (ids) =>
  api.get('/users/cosmetics', { params: { ids: Array.isArray(ids) ? ids.join(',') : ids } });

// ==================== PUSH (item 12) ====================
// Register the device's Expo push token so the server can notify even when the
// app is closed (chat messages, coach-planned workouts).
export const savePushToken = (userId, token) =>
  api.put(`/users/${userId}/pushtoken`, { token });

// ==================== WORKOUT BOARD + LEADERBOARD (A-3) ====================
export const getBoardFeed = (viewerId, { country = 'IL', page = 0, limit = 20 } = {}) =>
  api.get('/board', { params: { viewerId, country, page, limit } });
export const createBoardPost = (data) => api.post('/board', data);
export const deleteBoardPost = (postId, userId) =>
  api.delete(`/board/${postId}`, { params: { userId } });
export const toggleBoardLike = (postId, userId) =>
  api.post(`/board/${postId}/like/${userId}`, {});
// #170 — scope can be 'global' (default) or 'friends'. When 'friends', pass the
// viewer's id so the backend ranks only the viewer + their accepted friends.
export const getLeaderboard = ({
  country = 'IL',
  metric = 'load_weekly',
  limit = 50,
  scope = 'global',
  viewerId = null,
} = {}) =>
  api.get('/board/leaderboard', { params: { country, metric, limit, scope, viewerId } });
export const setLeaderboardOptIn = (userId, on) =>
  api.put(`/board/leaderboard/optin/${userId}`, null, { params: { on } });

// #143 — comments on a board post (+ one level of nested replies).
export const getBoardComments = (postId) =>
  api.get(`/board/${postId}/comments`);
export const addBoardComment = (postId, userId, text, parentCommentId = null) =>
  api.post(`/board/${postId}/comments`, { userID: Number(userId), text, parentCommentId });
export const deleteBoardComment = (commentId, userId) =>
  api.delete(`/board/comments/${commentId}`, { params: { userId } });

// #171 — kudos ("cheers") on a workout (ActivityLog). Toggle on/off; returns
// { count, kudoed } so the button reflects the viewer's own kudos state.
export const toggleKudos = (logId, fromUserId) =>
  api.post(`/board/kudos/${logId}/${fromUserId}`, {});
export const getKudos = (logId, viewerId) =>
  api.get(`/board/kudos/${logId}`, { params: { viewerId } });

// ==================== TRAINING CALENDAR (A-4) ====================
// from/to are 'YYYY-MM-DD' strings.
export const getCalendar = (userId, from, to) =>
  api.get(`/calendar/${userId}`, { params: { from, to } });
export const createPlannedWorkout = (userId, data) => api.post(`/calendar/${userId}`, data);
export const updatePlannedWorkout = (planId, data) => api.put(`/calendar/${planId}`, data);
export const deletePlannedWorkout = (planId) => api.delete(`/calendar/${planId}`);
export const completePlannedWorkout = (planId, linkedLogId) =>
  api.put(`/calendar/${planId}/complete`, null, { params: linkedLogId ? { linkedLogId } : {} });

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
// `imagePath` / `audioPath` (#139) / `videoPath` (#135) are paths returned by
// the matching upload helper below (all optional).
export const sendMessage = ({ senderId, receiverId, text, imagePath, audioPath, videoPath }) =>
  api.post('/messages', {
    senderID: Number(senderId),
    receiverID: Number(receiverId),
    text: text ?? '',
    imagePath: imagePath ?? null,
    audioPath: audioPath ?? null,
    videoPath: videoPath ?? null,
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
    const _t = getAuthToken();
    response = await fetch(url, {
      method: 'POST', body: form, signal: controller.signal,
      headers: _t ? { Authorization: `Bearer ${_t}` } : undefined,
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

// #139 / #135 — upload chat media (voice clip / form-check video) to the
// backend. `endpoint` is 'audio' or 'video'; returns { path } = "/media/...".
// Same raw-fetch + 90s AbortController pattern as uploadChatImage (video is
// bigger, hence the longer timeout). The server sniffs the bytes and derives
// the on-disk extension, so the client mime is only a hint.
const uploadChatMedia = async (endpoint, localUri, mime, fallbackName) => {
  const filename = localUri.split('/').pop() || fallbackName;
  const form = new FormData();
  form.append('file', { uri: localUri, name: filename, type: mime });

  const url = `${API_BASE_URL}/messages/upload/${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  let response;
  try {
    const _t = getAuthToken();
    response = await fetch(url, {
      method: 'POST', body: form, signal: controller.signal,
      headers: _t ? { Authorization: `Bearer ${_t}` } : undefined,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} — ${text || 'no response body'}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON: ${text.slice(0, 200)}`);
  }
};

export const uploadChatAudio = (localUri) =>
  uploadChatMedia('audio', localUri, 'audio/m4a', `voice_${Date.now()}.m4a`);
export const uploadChatVideo = (localUri) =>
  uploadChatMedia('video', localUri, 'video/mp4', `clip_${Date.now()}.mp4`);

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

// #138 — typing indicator. The sender pings while typing; the peer polls.
// Kept cheap (foreground-only, throttled in ChatScreen) to limit Azure burn.
export const setTyping = (fromUserId, toUserId, isTyping) =>
  api.put(`/messages/typing/${fromUserId}/${toUserId}`, { isTyping });
export const getTyping = (selfId, peerId) =>
  api.get(`/messages/typing/${peerId}/${selfId}`);

// #140 — emoji reactions on a message (toggle: same emoji again removes it).
export const reactToMessage = (messageId, userId, emoji) =>
  api.post(`/messages/${messageId}/react/${userId}`, { emoji });
// All reactions across a thread (so the bubbles can render them).
export const getThreadReactions = (userA, userB) =>
  api.get(`/messages/reactions/${userA}/${userB}`);

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

// A-2: opt in/out of sharing live location on the Connect map.
export const setShareLiveLocation = (userId, share) =>
  api.put(`/social/sharelocation/${userId}`, { share });

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

// #146 — seeded gyms MERGED with live Google Places results (server proxies the
// billable Places call; degrades to seeded-only when the key isn't configured).
export const getNearbyGyms = (lat, lng, radiusKm = 25) =>
  api.get('/gyms/nearby', { params: { lat, lng, radiusKm } });

export const getGymCoaches = (gymId) =>
  api.get(`/gyms/${gymId}/coaches`);

export const addCoachToGym = (gymId, coachUserId) =>
  api.post(`/gyms/${gymId}/coaches/${coachUserId}`, {});

export const removeCoachFromGym = (gymId, coachUserId) =>
  api.delete(`/gyms/${gymId}/coaches/${coachUserId}`);

export const getGymsForCoach = (coachUserId) =>
  api.get(`/gyms/for-coach/${coachUserId}`);

export default api;
