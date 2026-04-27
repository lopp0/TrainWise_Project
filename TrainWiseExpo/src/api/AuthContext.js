import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin } from './api';

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
      
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (!parsed.deviceId) {
          parsed.deviceId = await getOrCreateDeviceId();
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
        setUser(parsed);
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

      const userData = await apiLogin(email, password);
      const deviceId = await getOrCreateDeviceId();

      // Normalize field names if needed (backend returns userID, we store as userID)
      const normalizedUser = {
        userId: userData.userID || userData.userId,
        deviceId,
        fullName: userData.fullName,
        email: userData.email,
        userName: userData.userName,
        isCoach: userData.isCoach,
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
      };

      // Persist to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedUser));
      
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
   * Logout user.
   * Clears stored user and resets context state.
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await AsyncStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Error during logout:', err);
      setError('Logout failed');
    } finally {
      setIsLoading(false);
    }
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

  const value = {
    // State
    user,
    userId: user?.userId,
    deviceId: user?.deviceId, // May be added later
    isLoggedIn: !!user,
    isLoading,
    error,
    
    // Methods
    login,
    logout,
    updateUser,
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
