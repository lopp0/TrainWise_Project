// ניהול אימות משתמש — שמירת session, login, logout ועדכון פרטים
import React, { createContext, useState, useEffect, useCallback } from 'react';
// AsyncStorage לשמירת אובייקט המשתמש בין הפעלות
import AsyncStorage from '@react-native-async-storage/async-storage';
// פונקציית login מ-API
import { login as apiLogin } from './api';

/**
 * AuthContext
 *
 * מספק session-based authentication ל-TrainWise.
 * מאחסן אובייקט משתמש ב-Context וב-AsyncStorage לשמירה בין הפעלות.
 * אין JWT tokens — משתמש ב-userId מהאובייקט השמור לכל קריאות API.
 */

// יצירת ה-Context
export const AuthContext = createContext();

/**
 * AuthProvider — עוטף את האפליקציה ומספק מצב אימות ומתודות.
 * שימוש: עטוף ב-App.js:
 * <AuthProvider><NavigationStack /></AuthProvider>
 */
export const AuthProvider = ({ children }) => {
  // אובייקט המשתמש המחובר (null = לא מחובר)
  const [user, setUser] = useState(null);
  // האם האפליקציה בתהליך טעינה ראשונית מ-AsyncStorage
  const [isLoading, setIsLoading] = useState(true);
  // הודעת שגיאה אחרונה
  const [error, setError] = useState(null);

  // המפתח לשמירת אובייקט המשתמש ב-AsyncStorage
  const STORAGE_KEY = '@trainwise_user';
  // המפתח לשמירת ID ייחודי של המכשיר
  const DEVICE_ID_KEY = '@trainwise_device_id';

  // יצירת / קריאת device ID ייחודי — משמש לזיהוי המכשיר בצד השרת
  const getOrCreateDeviceId = async () => {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      // יצירת ID אקראי בפורמט: dev-timestamp-random
      id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  };

  /**
   * bootstrapAsync — משחזר משתמש מ-AsyncStorage בעת הפעלת האפליקציה.
   * אם נמצא משתמש שמור אך חסר deviceId — מוסיף אחד.
   */
  const bootstrapAsync = useCallback(async () => {
    try {
      setIsLoading(true);
      // קריאת האובייקט השמור
      const savedUser = await AsyncStorage.getItem(STORAGE_KEY);

      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        // בדיקה אם חסר deviceId (ייתכן במשתמשים ישנים לפני הוספת הפיצ'ר)
        if (!parsed.deviceId) {
          parsed.deviceId = await getOrCreateDeviceId();
          // שמירת הגרסה המעודכנת
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
   * login — כניסה עם אימייל וסיסמה.
   * קורא ל-API, מנרמל שמות שדות, שומר ב-AsyncStorage ומעדכן את ה-Context.
   */
  const login = useCallback(async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);

      // קריאת ה-API לאימות
      const userData = await apiLogin(email, password);
      // קבלת / יצירת deviceId
      const deviceId = await getOrCreateDeviceId();

      // נרמול שמות שדות — השרת מחזיר userID (גדול), אנו שומרים userId (קטן)
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

      // שמירה קבועה ב-AsyncStorage לשחזור בהפעלה הבאה
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
   * logout — ניתוק המשתמש.
   * מוחק מ-AsyncStorage ומאפס את ה-Context.
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      // מחיקת האובייקט מה-AsyncStorage
      await AsyncStorage.removeItem(STORAGE_KEY);
      // איפוס ה-state
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
   * updateUser — עדכון אובייקט המשתמש בזיכרון ובאחסון.
   * משמש לאחר עדכון פרופיל מ-SettingsScreen.
   */
  const updateUser = useCallback(async (updatedUser) => {
    try {
      // מיזוג הנתונים הקיימים עם הנתונים החדשים
      const mergedUser = { ...user, ...updatedUser };
      // שמירה ב-AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedUser));
      setUser(mergedUser);
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Failed to update user');
    }
  }, [user]);

  // הפעלת bootstrapAsync בעת עליית הקומפוננט
  useEffect(() => {
    bootstrapAsync();
  }, [bootstrapAsync]);

  // אובייקט הערכים שיועברו לכל הצאצאים דרך ה-Context
  const value = {
    // State
    user,                          // אובייקט המשתמש המלא
    userId: user?.userId,          // ID בלבד לנוחות
    deviceId: user?.deviceId,      // device ID
    isLoggedIn: !!user,            // boolean — האם מחובר
    isLoading,                     // האם טוען
    error,                         // הודעת שגיאה

    // Methods
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * useAuth — hook לגישה ל-AuthContext.
 * זורק שגיאה אם משתמשים מחוץ ל-AuthProvider.
 */
export const useAuth = () => {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;
