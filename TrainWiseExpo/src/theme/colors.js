import { darkPalette, lightPalette, PALETTES } from './palettes';

/**
 * `Colors` is exported as a mutable singleton so that the dozen+ screens
 * that already do `import { Colors } from '../theme/colors'` keep working
 * without a refactor. `applyTheme()` mutates the same object in place; the
 * ThemeProvider then forces a tree re-render via a key change so all
 * screens pick up the new values.
 */
export const Colors = { ...darkPalette };

let _activeTheme = 'dark';
const _listeners = new Set();

export const getActiveTheme = () => _activeTheme;

export const applyTheme = (themeName) => {
  const palette = PALETTES[themeName] || darkPalette;
  Object.keys(Colors).forEach((k) => delete Colors[k]);
  Object.assign(Colors, palette);
  _activeTheme = palette === lightPalette ? 'light' : 'dark';
  _listeners.forEach((fn) => fn(_activeTheme));
};

export const subscribeTheme = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

export const Fonts = {
  titleSize: 28,
  subtitleSize: 18,
  bodySize: 15,
  captionSize: 12,
  bold: '700',
  semiBold: '600',
  regular: '400',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
