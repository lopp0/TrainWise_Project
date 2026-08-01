import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin } from './api';
import { setActiveUserId } from '../utils/activeUser';
import { setAuthToken, clearAuthToken, loadAuthToken, setUnauthorizedHandler } from './authToken';
import { isBiometricEnabled, isBiometricSupported } from '../utils/biometric';

// Auth responses are now { token, user }. Older builds/paths may still return a
// bare user object, so tolerate both shapes.
const unwrapAuthResponse = (data) => ({
  token: data?.token ?? null,
  user: data?.user ?? data,
});

// Map a backend user payload (from email/password OR Google login) to the shape
// we persist. Shared so both login paths produce an identical stored user.
const normalizeUser = (userData, deviceId) => ({
  userId: userData.userID || userData.userId,
  deviceId,
  fullName: userData.fullName,
  email: userData.email,
  userName: userData.userName,
  isCoach: userData.isCoach,
  // Default true so users created before the IsTrainee column existed still see
  // the trainee UI. Coach-only is a deliberate opt-in.
  isTrainee: userData.isTrainee ?? true,
  profileImagePath: userData.profileImagePath ?? null,
  activityLevel: userData.activityLevel,
  height: userData.height,
  weight: userData.weight,
  birthYear: userData.birthYear,
  gender: userData.gender,
  deviceType: userData.deviceType,
  experienceLevel: userData.experienceLevel,
  baseLineDailyLoad: userData.baseLineDailyLoad,
  baseLineWeeklyLoad: userData.baseLineWeeklyLoad,
  isBaselineEstablished: userData.isBaselineEstablished,
  healthDeclaration: userData.healthDeclaration,
  confirmTerms: userData.confirmTerms,
});

/**
 * AuthContext
 * 
 * Provides session-based authentication for TrainWise.
 * Stores user object in context and AsyncStorage for persistence across app restarts.
 * No JWT tokens - uses userId from stored User object for API calls.
 */

export const AuthContext = createContext();

/**
 * AuthProvider - Wraps the app and provides auth state and methods.
 * 
 * @component
 * @example
 * // In App.js:
 * <AuthProvider>
 *   <NavigationStack />
 * </AuthProvider>
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // #112 — when biometric unlock is enabled, the restored session starts
  // `locked` and a full-screen overlay (rendered in App.js) blocks the app
  // until authenticateAsync succeeds. Fresh logins are never locked.
  const [locked, setLocked] = useState(false);

  const STORAGE_KEY = '@trainwise_user';
  const DEVICE_ID_KEY = '@trainwise_device_id';

  const getOrCreateDeviceId = async () => {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  };

  /**
   * Initialize auth - restore user from AsyncStorage if available.
   * Called on app startup.
   */
  const bootstrapAsync = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedUser = await AsyncStorage.getItem(STORAGE_KEY);
      // Restore the bearer token so API calls are authenticated after a restart.
      await loadAuthToken();

      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (!parsed.deviceId) {
          parsed.deviceId = await getOrCreateDeviceId();
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
        // Scope device-local stores (coins/items/streak) to this account
        // BEFORE any screen reads them.
        setActiveUserId(parsed.userId);
        setUser(parsed);
        // #112 — gate re-entry on biometrics when the user enabled it AND the
        // device still has biometrics enrolled (else don't lock them out).
        try {
          if ((await isBiometricEnabled()) && (await isBiometricSupported())) {
            setLocked(true);
          }
        } catch {}
      }
    } catch (error) {
      console.error('Failed to restore user session:', error);
      setError('Failed to restore session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login user with email and password.
   * Calls backend API, stores user object, and updates context.
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User object if successful
   * @throws {Error} If login fails
   */
  const login = useCallback(async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);

      const { token, user: userData } = unwrapAuthResponse(await apiLogin(email, password));
      const deviceId = await getOrCreateDeviceId();
      const normalizedUser = normalizeUser(userData, deviceId);

      // Store the signed token FIRST so any follow-up request is authenticated.
      await setAuthToken(token);
      // Persist to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedUser));

      setActiveUserId(normalizedUser.userId);
      setUser(normalizedUser);
      return normalizedUser;
    } catch (err) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Establish a session from a backend user object returned by Google sign-in
   * (POST /api/users/google-login). Same normalize + persist as `login`, but the
   * credential check already happened (server verified the Google ID token).
   */
  const loginWithGoogleUser = useCallback(async (userData) => {
    try {
      setIsLoading(true);
      setError(null);
      const { token, user: u } = unwrapAuthResponse(userData);
      const deviceId = await getOrCreateDeviceId();
      const normalizedUser = normalizeUser(u, deviceId);
      await setAuthToken(token);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedUser));
      setActiveUserId(normalizedUser.userId);
      setUser(normalizedUser);
      return normalizedUser;
    } catch (err) {
      setError(err.message || 'Google login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user.
   * Clears stored user and resets context state.
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await AsyncStorage.removeItem(STORAGE_KEY);
      await clearAuthToken();
      setActiveUserId(null);
      setUser(null);
      setLocked(false);
      setError(null);
    } catch (err) {
      console.error('Error during logout:', err);
      setError('Logout failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Let the axios interceptors force a logout when the backend rejects the
  // stored token (401). Without this a stale token — e.g. one minted by the
  // LOCAL backend after switching BACKEND_MODE to 'azure' — left the app
  // "logged in" on cached data while every request silently failed.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      setActiveUserId(null);
      setUser(null);
      setLocked(false);
      setError('Your session expired. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  /**
   * Update user object in context and AsyncStorage.
   * Used when user info changes (e.g., profile update).
   * 
   * @param {Object} updatedUser - Updated user object
   */
  const updateUser = useCallback(async (updatedUser) => {
    try {
      const mergedUser = { ...user, ...updatedUser };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedUser));
      setUser(mergedUser);
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Failed to update user');
    }
  }, [user]);

  // Bootstrap on mount
  useEffect(() => {
    bootstrapAsync();
  }, [bootstrapAsync]);

  // #112 — called by the lock overlay once biometric auth succeeds.
  const unlock = useCallback(() => setLocked(false), []);

  const value = {
    // State
    user,
    userId: user?.userId,
    deviceId: user?.deviceId, // May be added later
    isLoggedIn: !!user,
    isLoading,
    locked,
    error,

    // Methods
    login,
    loginWithGoogleUser,
    logout,
    updateUser,
    unlock,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to access auth context.
 * 
 * @example
 * const { user, userId, login, logout, isLoggedIn } = useAuth();
 * 
 * @returns {Object} Auth context value
 * @throws {Error} If hook is not used within AuthProvider
 */
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
