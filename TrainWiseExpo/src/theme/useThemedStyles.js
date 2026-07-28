import { useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { Colors } from './colors';

/**
 * Returns a stylesheet that re-evaluates whenever the active theme changes.
 *
 * Why this exists:
 *   `Colors` is a mutable singleton swapped in place by `applyTheme`. But
 *   `StyleSheet.create({ bg: Colors.background })` at MODULE level reads
 *   `Colors.background` once at import time and freezes the value into
 *   the registered style object. After mutating `Colors`, the stylesheet
 *   still points at the old hex. Re-mounting components doesn't help —
 *   modules are cached so the module-level styles object is reused.
 *
 *   Moving styles INSIDE the component body and memoizing them on the
 *   `theme` key fixes it: when `theme` flips, useMemo re-runs the factory
 *   against the now-updated `Colors` object and a fresh StyleSheet is
 *   registered.
 *
 * Usage:
 *   const ProfileScreen = () => {
 *     const styles = useThemedStyles(makeStyles);
 *     return <View style={styles.safe}>...</View>;
 *   };
 *   const makeStyles = (Colors) => StyleSheet.create({ ... });
 */
export const useThemedStyles = (factory) => {
  const { theme } = useTheme();
  return useMemo(() => factory(Colors), [theme, factory]);
};
