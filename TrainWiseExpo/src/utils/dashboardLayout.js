import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * #116 — Customizable Home dashboard.
 *
 * The user can reorder and hide the optional dashboard widgets (the always-on
 * essentials — Add Workout, Add Injury, active-injury + re-injury banners —
 * stay fixed). The chosen order + visibility is persisted PER ACCOUNT, the same
 * pattern as the seen-coach-plans key, so two users on one device keep separate
 * layouts.
 *
 * Layout shape: an ordered array of { key, visible }.
 */
export const DASHBOARD_SECTIONS = {
  smart: 'Smart workout',
  recommendation: 'Load recommendation',
  chart: 'Weekly load chart',
  summary: 'This week at a glance',
  goal: 'Weekly goal',
  quests: 'Quests',
  calories: 'Calorie balance',
  recovery: 'Recovery / readiness', // #129/#130
};

const SECTION_KEYS = Object.keys(DASHBOARD_SECTIONS);

export const DEFAULT_DASHBOARD_LAYOUT = SECTION_KEYS.map((key) => ({ key, visible: true }));

const storageKey = (userId) => `@trainwise_dashboard_layout_${userId}`;

const cloneDefault = () => DEFAULT_DASHBOARD_LAYOUT.map((s) => ({ ...s }));

// Reconcile a saved layout with the current section list: drop unknown keys,
// append any newly-added sections at the end (visible) so an app update that
// introduces a widget doesn't hide it.
const reconcile = (saved) => {
  if (!Array.isArray(saved)) return cloneDefault();
  const known = new Set(SECTION_KEYS);
  const filtered = saved.filter((s) => s && known.has(s.key)).map((s) => ({ key: s.key, visible: s.visible !== false }));
  const present = new Set(filtered.map((s) => s.key));
  SECTION_KEYS.forEach((k) => {
    if (!present.has(k)) filtered.push({ key: k, visible: true });
  });
  return filtered;
};

export const getDashboardLayout = async (userId) => {
  if (!userId) return cloneDefault();
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return raw ? reconcile(JSON.parse(raw)) : cloneDefault();
  } catch {
    return cloneDefault();
  }
};

export const setDashboardLayout = async (userId, layout) => {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(layout));
  } catch {
    // ignore write errors — layout just won't persist this time
  }
};
