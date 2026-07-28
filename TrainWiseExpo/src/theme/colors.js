import { darkPalette, lightPalette, PALETTES, ACCENTS } from './palettes';

/**
 * `Colors` is exported as a mutable singleton so that the dozen+ screens
 * that already do `import { Colors } from '../theme/colors'` keep working
 * without a refactor. `applyTheme()` mutates the same object in place; the
 * ThemeProvider then forces a tree re-render via a key change so all
 * screens pick up the new values.
 */
export const Colors = { ...darkPalette };

let _activeTheme = 'dark';
let _activeAccent = 'default';
const _listeners = new Set();

export const getActiveTheme = () => _activeTheme;
export const getActiveAccent = () => _activeAccent;

/**
 * Applies a theme. `themeName` is the base mode ('dark' | 'light').
 * `accentName` is optional (#160): when provided it becomes the active accent;
 * when omitted the current accent is kept (so a mode flip preserves the accent).
 * The accent only overrides the primary color family on top of the mode palette.
 */
export const applyTheme = (themeName, accentName) => {
  const palette = PALETTES[themeName] || darkPalette;
  if (accentName !== undefined) {
    _activeAccent = ACCENTS[accentName] ? accentName : 'default';
  }
  const accentColors = ACCENTS[_activeAccent]?.colors || null;
  Object.keys(Colors).forEach((k) => delete Colors[k]);
  Object.assign(Colors, palette);
  if (accentColors) Object.assign(Colors, accentColors);
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
