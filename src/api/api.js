import axios from 'axios';
import { getAuthToken } from './authToken';
// Single source of truth for the backend URL — flip BACKEND_MODE in
// src/config/backend.js to switch the whole app between Local‑LAN and Azure.
import { API_BASE_URL } from '../config/backend';

/**
 * Shared axios instance for all API calls to the TrainWise backend.
 * Attaches the signed JWT (when present) so the backend can verify identity.
 */
const BASE_URL = API_BASE_URL;
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the bearer token to every request when the user is logged in.
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
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
    const response = await apiClient.post('/auth/login', {
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
 * Google Sign-In: send the Google ID token (from the native picker) to the
 * backend, which verifies it and returns the existing-or-created user.
 * `isSignUp: true` (Sign-Up screen) makes the backend block an already-existing
 * Google account (409); false/omitted (Login screen) logs in / links / creates.
 * @param {{ idToken: string, email?: string, fullName?: string, isSignUp?: boolean }} payload
 */
export const googleLogin = async ({ idToken, email, fullName, isSignUp = false }) => {
  try {
    const response = await apiClient.post('/Users/google-login', {
      idToken,
      email,
      fullName,
      isSignUp,
    });
    return response.data;
  } catch (error) {
    if (!error.response) {
      // No HTTP response — network/timeout/unreachable backend.
      throw new Error(`Cannot reach the server (${error.message}).`);
    }
    const { status, data } = error.response;
    let detail;
    if (typeof data === 'string' && data.trim()) {
      detail = data;
    } else if (data?.errors && typeof data.errors === 'object') {
      // ASP.NET ValidationProblemDetails — surface the field errors.
      detail = Object.entries(data.errors)
        .map(([f, e]) => `${f}: ${Array.isArray(e) ? e.join(', ') : e}`)
        .join('; ');
    } else {
      detail = data?.title || data?.detail || data?.message || 'unknown error';
    }
    throw new Error(`Google sign-in failed (${status}): ${detail}`);
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
    const response = await apiClient.post('/Users', payload);
    return response.data;
  } catch (error) {
    // Backend can return either a string ("UserName is required") or an
    // ASP.NET ValidationProblemDetails object (when JSON model binding
    // fails on a non-nullable int/byte field). `new Error(object)` would
    // stringify to "[object Object]" — extract the useful parts instead.
    const data = error.response?.data;
    let message = 'Registration failed. Please try again.';
    if (typeof data === 'string' && data.trim()) {
      message = data;
    } else if (data && typeof data === 'object') {
      if (data.errors && typeof data.errors === 'object') {
        message = Object.entries(data.errors)
          .map(([field, errs]) =>
            `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`
          )
          .join('\n');
      } else if (data.title) {
        message = data.title;
      } else if (data.detail) {
        message = data.detail;
      }
    } else if (error.message) {
      message = error.message;
    }
    throw new Error(message);
  }
};

/**
 * Request a password reset code be emailed to the given address.
 * Always resolves (backend returns a generic message either way, so this
 * can't be used to probe which emails are registered).
 * @param {string} email
 */
export const requestPasswordReset = async (email) => {
  try {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  } catch (error) {
    const data = error.response?.data;
    throw new Error(typeof data === 'string' && data.trim() ? data : 'Could not send reset code. Please try again.');
  }
};

/**
 * Verify a password reset code without consuming it.
 * @param {string} email
 * @param {string} code - 6-digit code from the email
 */
export const verifyResetCode = async (email, code) => {
  try {
    const response = await apiClient.post('/auth/verify-reset-code', { email, code });
    return response.data;
  } catch (error) {
    const data = error.response?.data;
    throw new Error(typeof data === 'string' && data.trim() ? data : 'Invalid or expired code.');
  }
};

/**
 * Complete the reset: verifies the code again and sets the new password.
 * @param {string} email
 * @param {string} code
 * @param {string} newPassword
 */
export const resetPassword = async (email, code, newPassword) => {
  try {
    const response = await apiClient.post('/auth/reset-password', { email, code, newPassword });
    return response.data;
  } catch (error) {
    const data = error.response?.data;
    throw new Error(typeof data === 'string' && data.trim() ? data : 'Could not reset password. Please try again.');
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
    const response = await apiClient.get(`/ActivityLog/user/${userId}`);
    return response.data;
  } catch (error) {
    // Surface the actual cause (network vs HTTP status vs server message).
    // Network errors are an expected dev condition — we don't log them
    // here at all; the caller (SyncService / HealthSyncContext / Home /
    // GoogleFit) decides whether to warn or not based on its own context.
    const status = error.response?.status;
    const body = error.response?.data;
    if (status) {
      const detail = `HTTP ${status}${body ? ` — ${typeof body === 'string' ? body : JSON.stringify(body)}` : ''}`;
      console.warn('[api] getActivityLogs failed:', detail);
      throw new Error(`Failed to fetch activity logs (${detail})`);
    }
    // Pure network error — propagate the axios message unchanged so
    // callers can pattern-match on /network/ for graceful handling.
    throw new Error(error.message || 'Network Error');
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
    const response = await apiClient.post('/ActivityLog', activityData);
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
    const response = await apiClient.put('/ActivityLog', activityData);
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
    await apiClient.delete(`/ActivityLog/${activityLogId}`);
  } catch (error) {
    console.error('Error deleting activity log:', error?.response?.data || error.message);
    // Surface the REAL backend reason (e.g. a SQL/constraint message) instead of
    // a generic string, so the failure is diagnosable on-device.
    const detail =
      error?.response?.data ||
      (error?.response?.status ? `Server error ${error.response.status}` : null) ||
      error?.message ||
      'Failed to delete activity log';
    throw new Error(typeof detail === 'string' ? detail : 'Failed to delete activity log');
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
    const response = await apiClient.get(`/users/${userId}/devices`);
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
      `/users/${userId}/devices`,
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
      `/users/${userId}/devices/${deviceId}`,
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
