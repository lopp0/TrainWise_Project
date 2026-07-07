import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, getActiveTheme, getActiveAccent } from './colors';
import { ACCENTS } from './palettes';
import {
  getThemeSchedule,
  setThemeSchedule,
  scheduledTheme,
  THEME_SCHEDULE_DEFAULTS,
} from '../utils/themeSchedule';

const STORAGE_KEY = 'trainwise.theme';
const ACCENT_KEY = 'trainwise.accent';

const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  accent: 'default',
  setAccent: () => {},
  autoTheme: THEME_SCHEDULE_DEFAULTS,
  updateAutoTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getActiveTheme());
  const [accent, setAccentState] = useState(getActiveAccent());
  const [autoTheme, setAutoThemeState] = useState(THEME_SCHEDULE_DEFAULTS);

  // Hydrate persisted theme + accent + schedule on mount.
  useEffect(() => {
    (async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(STORAGE_KEY);
        const savedAccent = await AsyncStorage.getItem(ACCENT_KEY);
        const sched = await getThemeSchedule();
        const t = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : getActiveTheme();
        const a = ACCENTS[savedAccent] ? savedAccent : 'default';
        // When the auto-schedule is on, it wins over the saved mode at launch.
        const effectiveTheme = sched.enabled ? scheduledTheme(sched) : t;
        applyTheme(effectiveTheme, a);
        setThemeState(effectiveTheme);
        setAccentState(a);
        setAutoThemeState(sched);
      } catch {}
    })();
  }, []);

  const setTheme = useCallback(async (next) => {
    const safe = next === 'light' ? 'light' : 'dark';
    applyTheme(safe); // keeps the current accent
    setThemeState(safe);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, safe);
    } catch {}
  }, []);

  const setAccent = useCallback(async (next) => {
    const safe = ACCENTS[next] ? next : 'default';
    applyTheme(getActiveTheme(), safe);
    setAccentState(safe);
    try {
      await AsyncStorage.setItem(ACCENT_KEY, safe);
    } catch {}
  }, []);

  // #179 — update the auto-dark schedule and apply it immediately.
  const updateAutoTheme = useCallback(async (patch) => {
    const next = await setThemeSchedule(patch);
    setAutoThemeState(next);
    if (next.enabled) {
      const want = scheduledTheme(next);
      if (want !== getActiveTheme()) {
        applyTheme(want);
        setThemeState(want);
      }
    }
  }, []);

  // While auto-theme is enabled, re-check on a 60s tick + whenever the app
  // returns to the foreground, flipping the mode when the window boundary
  // is crossed.
  useEffect(() => {
    if (!autoTheme.enabled) return undefined;
    const apply = () => {
      const want = scheduledTheme(autoTheme);
      if (want !== getActiveTheme()) {
        applyTheme(want);
        setThemeState(want);
      }
    };
    apply();
    const timer = setInterval(apply, 60000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') apply();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [autoTheme.enabled, autoTheme.darkStart, autoTheme.darkEnd]);

  // The `key` on the wrapper forces every descendant to re-mount when the
  // theme OR accent switches. That way screens which destructured Colors at
  // render time pick up the new palette without needing per-component context
  // wiring. The cost (one full re-render on toggle) is acceptable for a
  // user-initiated settings change.
  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent, autoTheme, updateAutoTheme }}>
      <React.Fragment key={`${theme}:${accent}`}>{children}</React.Fragment>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
