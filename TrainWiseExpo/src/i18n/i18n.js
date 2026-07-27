import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from './translations';

/**
 * ENGLISH ONLY (2026-07-19).
 *
 * The in-app language picker (#156) was dropped by request — TrainWise ships in
 * English only. `t(key)` is kept because the navigator and a few screens call it;
 * it now always resolves against the English dictionary and falls back to the key
 * itself, so no string ever renders blank.
 *
 * `initLanguage()` is also a MIGRATION: a user who had picked Hebrew before this
 * change had `I18nManager.forceRTL(true)` written natively (it survives restarts).
 * With the picker gone they'd be stranded in a right-to-left layout forever, so we
 * clear the saved language and force the layout back to left-to-right once.
 */
const STORAGE_KEY = '@trainwise_language';

export const getLanguage = () => 'en';
export const isRTL = () => false;

export const t = (key, fallback) => translations.en[key] ?? fallback ?? key;

export const initLanguage = async () => {
  // Undo a previously-forced RTL layout (Hebrew) now that the picker is gone.
  try {
    if (I18nManager.isRTL) {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    }
  } catch {}
  // Drop any saved non-English preference so nothing re-applies it later.
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && saved !== 'en') await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
  return 'en';
};
