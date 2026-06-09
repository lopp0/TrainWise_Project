import { Colors } from '../theme/colors';

export const acRatioToLevel = (ratio) => {
  if (ratio == null || ratio <= 0) return 'Green';
  if (ratio > 1.3) return 'Red';
  if (ratio >= 0.8) return 'Yellow';
  return 'Green';
};

export const buildRestRecommendation = ({ acRatio, loadLevel, hasActiveInjury } = {}) => {
  const ratio = Number(acRatio) || 0;
  const level = loadLevel || acRatioToLevel(ratio);
  const ratioText = ratio > 0 ? ratio.toFixed(2) : null;

  if (ratio <= 0) {
    return {
      urgency: 'none',
      level: 'Green',
      title: 'No data yet',
      icon: 'fitness-outline',
      color: Colors.textSecondary,
      shortText: 'Log a workout to start tracking your training load.',
      injuryWarning: null,
    };
  }

  if (level === 'Red') {
    const injuryWarning = hasActiveInjury
      ? 'You have an active injury and your load is in the high-risk zone — rest is strongly recommended.'
      : null;
    return {
      urgency: 'rest',
      level: 'Red',
      title: hasActiveInjury ? 'Rest today — injury risk' : 'Rest today',
      icon: 'bed-outline',
      color: Colors.red,
      shortText: `High training load (AC ${ratioText}). Take a rest day.`,
      injuryWarning,
    };
  }

  if (level === 'Yellow') {
    const injuryWarning = hasActiveInjury
      ? 'You have an active injury — keep intensity easy and avoid hard sessions.'
      : null;
    return {
      urgency: 'light',
      level: 'Yellow',
      title: 'Keep it light',
      icon: 'walk-outline',
      color: Colors.yellow,
      shortText: `Moderate load (AC ${ratioText}). An easy session is best today.`,
      injuryWarning,
    };
  }

  const injuryWarning = hasActiveInjury
    ? 'You have an active injury — listen to your body even though load is low.'
    : null;
  return {
    urgency: 'train',
    level: 'Green',
    title: 'Good to train',
    icon: 'barbell-outline',
    color: Colors.green,
    shortText: `Safe training zone (AC ${ratioText}). A challenging session is fine.`,
    injuryWarning,
  };
};
