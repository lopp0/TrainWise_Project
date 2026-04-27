import axios from 'axios';

/**
 * Shared axios instance for all API calls to the TrainWise backend.
 * No JWT token system - uses session-based auth with userId.
 */

// API Configuration
const BASE_URL = 'http://127.0.0.1:5249'; // Reaches PC via `adb reverse tcp:5249 tcp:5249` over USB
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

/**
 * Login user with email and password.
 * Returns full User object on success.
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User object containing userId, fullName, etc.
 */
export const login = async (email, password) => {
  try {
    const response = await apiClient.post('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data || 'Login failed. Please check your credentials.'
    );
  }
};

/**
 * Register a new user. Backend hard-codes ProfileImagePath, baseline fields, and CreatedAt
 * server-side — extra fields in the payload are ignored by the ASP.NET deserializer.
 * @param {Object} payload - CreateUserRequest shape: fullName, birthYear, gender, height,
 *   weight, activityLevel, deviceType, userName, email, password, experienceLevel,
 *   healthDeclaration, confirmTerms, termConfirmationDate, isCoach.
 * @returns {Promise<Object>} `{ userID }` on success
 */
export const registerUser = async (payload) => {
  try {
    const response = await apiClient.post('/api/Users', payload);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data || 'Registration failed. Please try again.'
    );
  }
};

// ============================================================================
// ACTIVITY LOG ENDPOINTS
// ============================================================================

/**
 * Fetch all activity logs for a specific user.
 * @param {number} userId - The user ID
 * @returns {Promise<Array>} Array of activity log objects
 */
export const getActivityLogs = async (userId) => {
  try {
    const response = await apiClient.get(`/api/ActivityLog/user/${userId}`);
    return response.data;
  } catch (error) {
    // Surface the actual cause (network vs HTTP status vs server message)
    // so a failure here doesn't show up as the opaque "Failed to fetch
    // activity logs" RedBox. Common causes: backend down, adb reverse not
    // set after fresh APK install, or a 500 from the controller.
    const status = error.response?.status;
    const body = error.response?.data;
    const detail = status
      ? `HTTP ${status}${body ? ` — ${typeof body === 'string' ? body : JSON.stringify(body)}` : ''}`
      : error.message || 'Network error';
    console.warn('[api] getActivityLogs failed:', detail);
    throw new Error(`Failed to fetch activity logs (${detail})`);
  }
};

/**
 * Create a new activity log entry.
 * Must include all required fields from the activity log schema.
 * @param {Object} activityData - Activity log object
 * @returns {Promise<Object>} Created activity log with ID
 */
export const postActivityLog = async (activityData) => {
  try {
    const response = await apiClient.post('/api/ActivityLog', activityData);
    return response.data;
  } catch (error) {
    console.error('Error creating activity log:', error);
    throw new Error('Failed to create activity log');
  }
};

/**
 * Update an existing activity log.
 * @param {Object} activityData - Activity log object with ID
 * @returns {Promise<Object>} Updated activity log
 */
export const putActivityLog = async (activityData) => {
  try {
    const response = await apiClient.put('/api/ActivityLog', activityData);
    return response.data;
  } catch (error) {
    console.error('Error updating activity log:', error);
    throw new Error('Failed to update activity log');
  }
};

/**
 * Delete an activity log by ID.
 * @param {number} activityLogId - The activity log ID to delete
 * @returns {Promise<void>}
 */
export const deleteActivityLog = async (activityLogId) => {
  try {
    await apiClient.delete(`/api/ActivityLog/${activityLogId}`);
  } catch (error) {
    console.error('Error deleting activity log:', error);
    throw new Error('Failed to delete activity log');
  }
};

// ============================================================================
// USER DEVICE ENDPOINTS
// ============================================================================

/**
 * Fetch all devices linked to a user.
 * @param {number} userId - The user ID
 * @returns {Promise<Array>} Array of device objects
 */
export const getUserDevices = async (userId) => {
  try {
    const response = await apiClient.get(`/api/users/${userId}/devices`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user devices:', error);
    throw new Error('Failed to fetch user devices');
  }
};

/**
 * Register a new device for a user.
 * @param {number} userId - The user ID
 * @param {Object} deviceData - Device info (deviceName, lastSync, permissionsGranted)
 * @returns {Promise<Object>} Created device object with ID
 */
export const postUserDevice = async (userId, deviceData) => {
  try {
    const response = await apiClient.post(
      `/api/users/${userId}/devices`,
      deviceData
    );
    return response.data;
  } catch (error) {
    console.error('Error creating user device:', error);
    throw new Error('Failed to register device');
  }
};

/**
 * Update device information (e.g., lastSync timestamp).
 * @param {number} userId - The user ID
 * @param {number} deviceId - The device ID
 * @param {Object} deviceData - Updated device info
 * @returns {Promise<Object>} Updated device object
 */
export const putUserDevice = async (userId, deviceId, deviceData) => {
  try {
    const response = await apiClient.put(
      `/api/users/${userId}/devices/${deviceId}`,
      deviceData
    );
    return response.data;
  } catch (error) {
    console.error('Error updating user device:', error);
    throw new Error('Failed to update device');
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Update the base URL dynamically (useful for env-based URLs).
 * @param {string} newUrl - New base URL
 */
export const setBaseURL = (newUrl) => {
  apiClient.defaults.baseURL = newUrl;
};

/**
 * Get the current base URL.
 * @returns {string} Current base URL
 */
export const getBaseURL = () => {
  return apiClient.defaults.baseURL;
};

export default apiClient;
