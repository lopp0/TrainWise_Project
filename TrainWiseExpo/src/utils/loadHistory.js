import { parseServerDate } from './serverDate';

/**
 * #115 — Monthly / yearly load history. Aggregates confirmed session loads into
 * bars for a Week / Month / Year range, client-side from the logs the screen
 * already has. Week = 7 daily bars, Month = 6 weekly buckets, Year = 12 monthly
 * buckets.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const confirmed = (logs) => (logs || []).filter((l) => (l.isConfirmed ?? l.IsConfirmed) !== false);
const loadOf = (l) => Number(l.calculatedLoadForSession ?? l.CalculatedLoadForSession ?? 0);

const sumInRange = (logs, start, end) =>
  logs.reduce((s, l) => {
    const t = parseServerDate(l.startTime || l.StartTime);
    return t >= start && t <= end ? s + loadOf(l) : s;
  }, 0);

export const aggregateLoadHistory = (logsRaw, range) => {
  const logs = confirmed(logsRaw);
  const now = new Date();
  const bars = [];

  if (range === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(now.getDate() - i);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      bars.push({ label: DOW[d.getDay()], load: Math.round(sumInRange(logs, d, end)) });
    }
  } else if (range === 'month') {
    for (let i = 5; i >= 0; i--) {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      end.setDate(now.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      bars.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, load: Math.round(sumInRange(logs, start, end)) });
    }
  } else {
    // year — 12 calendar months ending this month
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      bars.push({ label: MONTHS[start.getMonth()], load: Math.round(sumInRange(logs, start, end)) });
    }
  }

  const max = Math.max(...bars.map((b) => b.load), 1);
  const total = bars.reduce((s, b) => s + b.load, 0);
  return { bars, max, total };
};
