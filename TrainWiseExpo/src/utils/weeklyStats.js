import { Colors } from '../theme/colors';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const getLoadStatus = (load) => {
  if (!load || load <= 0) {
    return { key: 'none', label: 'No workout', color: Colors.textMuted };
  }
  if (load < 150) return { key: 'light', label: 'Light', color: '#00e676' };
  if (load < 300) return { key: 'moderate', label: 'Moderate', color: '#ffee58' };
  if (load < 500) return { key: 'high', label: 'High', color: '#ff9800' };
  return { key: 'veryHigh', label: 'Very high', color: '#f44336' };
};

export const computeWeeklyStats = (weeklyData) => {
  const days = weeklyData || [];
  const trainedDays = days.filter((d) => d.load > 0);
  const totalLoad = days.reduce((sum, d) => sum + (d.load || 0), 0);
  const workoutCount = trainedDays.length;
  const avgLoad = workoutCount > 0 ? Math.round(totalLoad / workoutCount) : 0;

  let peakDay = null;
  let peakLoad = 0;
  days.forEach((d) => {
    if (d.load > peakLoad) {
      peakLoad = d.load;
      peakDay = DAY_LABELS[d.dayIndex];
    }
  });

  return {
    workoutCount,
    totalLoad: Math.round(totalLoad),
    avgLoad,
    peakDay,
    peakLoad: Math.round(peakLoad),
    hasData: totalLoad > 0,
  };
};

export const computeDailyStats = (weeklyData) => {
  if (!weeklyData || weeklyData.length === 0) return null;
  const todayIdx = new Date().getDay();
  const todayEntry = weeklyData.find((d) => d.dayIndex === todayIdx);
  if (!todayEntry) return null;
  const status = getLoadStatus(todayEntry.load);
  return {
    load: todayEntry.load,
    status,
    hasWorkout: todayEntry.load > 0,
  };
};
