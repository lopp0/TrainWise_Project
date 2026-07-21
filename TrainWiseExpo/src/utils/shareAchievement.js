import { Share } from 'react-native';

/**
 * #172 — Share an achievement / personal record. Uses the OS share sheet
 * (React Native's built-in Share) so it works to any app — messaging, social,
 * email — with NO extra native module (so it ships on a plain JS build without a
 * prebuild that could disturb the Health Connect manifest).
 *
 * A branded IMAGE card (render-to-PNG) would need `react-native-view-shot`, a
 * native dependency requiring a full rebuild; that is the documented upgrade
 * path. This text+link share is the no-native-dep version.
 */
export const shareAchievement = async ({ title, detail }) => {
  const parts = [
    `🏆 ${title} on TrainWise!`,
    detail ? detail : null,
    'Track your training load and prevent injuries with TrainWise 💪',
  ].filter(Boolean);
  try {
    await Share.share({ message: parts.join('\n') });
  } catch {
    // user dismissed / share unavailable — nothing to do
  }
};
