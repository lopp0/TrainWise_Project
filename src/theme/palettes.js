/**
 * Two color palettes for the app theme. The mint/teal/navy values come
 * from the TrainWise logo (assets/images/wowowow.png). Pink (#E91E63) is
 * kept as the brand accent in both themes so it stays recognizable.
 */

export const darkPalette = {
  background: '#0A1628',
  cardBackground: '#132036',
  cardBackgroundLight: '#1A2A44',
  primary: '#E91E63',
  primaryLight: '#FF4081',
  primaryDark: '#C2185B',
  accent: '#FF6090',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0BEC5',
  textMuted: '#6C7A89',
  success: '#4CAF50',
  warning: '#FFC107',
  danger: '#F44336',
  border: '#1E3254',
  inputBackground: '#0F1E36',
  inputBorder: '#2A3F5F',
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(10, 22, 40, 0.85)',
  green: '#4CAF50',
  yellow: '#FFC107',
  red: '#F44336',
};

export const lightPalette = {
  background: '#F5FBF9',
  cardBackground: '#FFFFFF',
  cardBackgroundLight: '#EAF6F1',
  primary: '#3A8AA3',          // teal from the logo's outer ring
  primaryLight: '#7EE8C4',     // mint from the logo's shield
  primaryDark: '#266375',
  accent: '#E91E63',           // brand pink retained for emphasis
  textPrimary: '#0D1F2D',
  textSecondary: '#3C4F5E',
  textMuted: '#7A8A96',
  success: '#1FAA6B',
  warning: '#E6A800',
  danger: '#D33F49',
  border: '#D6ECE2',
  inputBackground: '#F0F8F5',
  inputBorder: '#BFD9CD',
  shadow: 'rgba(13, 31, 45, 0.08)',
  overlay: 'rgba(13, 31, 45, 0.4)',
  green: '#1FAA6B',
  yellow: '#E6A800',
  red: '#D33F49',
};

export const PALETTES = {
  dark: darkPalette,
  light: lightPalette,
};

/**
 * #160 — Accent themes. Each accent overrides only the `primary` family
 * (primary / primaryLight / primaryDark / accent) on top of whichever base
 * mode (dark/light) is active. `default` = null means "keep the mode's own
 * built-in accent" (pink in dark, teal in light) so existing behavior is
 * unchanged until the user picks something else. The colors are saturated
 * mid-tones chosen to read well on both the dark navy and light mint
 * backgrounds. `swatch` is the dot shown in the Settings picker.
 */
export const ACCENTS = {
  default: { label: 'Default', swatch: '#E91E63', colors: null },
  pink: {
    label: 'Pink',
    swatch: '#E91E63',
    colors: { primary: '#E91E63', primaryLight: '#FF4081', primaryDark: '#C2185B', accent: '#FF6090' },
  },
  teal: {
    label: 'Teal',
    swatch: '#1FB6A6',
    colors: { primary: '#1FB6A6', primaryLight: '#5BE0D0', primaryDark: '#13897D', accent: '#34CFBE' },
  },
  purple: {
    label: 'Purple',
    swatch: '#8E44AD',
    colors: { primary: '#8E44AD', primaryLight: '#B26FD2', primaryDark: '#6C3483', accent: '#C39BD3' },
  },
  blue: {
    label: 'Blue',
    swatch: '#2979FF',
    colors: { primary: '#2979FF', primaryLight: '#5393FF', primaryDark: '#1565C0', accent: '#448AFF' },
  },
  orange: {
    label: 'Orange',
    swatch: '#F57C00',
    colors: { primary: '#F57C00', primaryLight: '#FFB74D', primaryDark: '#E65100', accent: '#FFA726' },
  },
  green: {
    label: 'Green',
    swatch: '#2E9E5B',
    colors: { primary: '#2E9E5B', primaryLight: '#5CC98A', primaryDark: '#1B7742', accent: '#43B373' },
  },
};

export const ACCENT_NAMES = Object.keys(ACCENTS);
export const ACCENT_LIST = ACCENT_NAMES.map((name) => ({ name, ...ACCENTS[name] }));
