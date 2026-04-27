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
