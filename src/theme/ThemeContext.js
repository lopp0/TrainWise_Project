import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, getActiveTheme } from './colors';

const STORAGE_KEY = 'trainwise.theme';

const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getActiveTheme());

  // Hydrate persisted theme on mount.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          applyTheme(saved);
          setThemeState(saved);
        }
      } catch {}
    })();
  }, []);

  const setTheme = useCallback(async (next) => {
    const safe = next === 'light' ? 'light' : 'dark';
    applyTheme(safe);
    setThemeState(safe);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, safe);
    } catch {}
  }, []);

  // The `key` on the wrapper forces every descendant to re-mount when the
  // theme switches. That way screens which destructured Colors at render
  // time pick up the new palette without needing per-component context
  // wiring. The cost (one full re-render on toggle) is acceptable for a
  // user-initiated settings change.
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <React.Fragment key={theme}>{children}</React.Fragment>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
