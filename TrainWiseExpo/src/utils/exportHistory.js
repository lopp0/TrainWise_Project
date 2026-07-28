import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getActivityLogsByUser, getAllActivityTypes } from '../services/api';
import { parseServerDate } from './serverDate';

/**
 * #123 — Export the logged-in user's workout history to a CSV file and open the
 * share sheet. Client-side only (no backend) and scoped to the caller's own data
 * (getActivityLogsByUser is ownership-gated server-side).
 *
 * Security: guards against CSV injection — a cell whose value starts with
 * = + - @ (or a control char) is prefixed with a single quote so spreadsheet
 * apps don't execute it as a formula. Fields are always quoted + quote-escaped.
 */

// Prefix formula-trigger characters so Excel/Sheets treat the cell as text.
const sanitizeCell = (raw) => {
  let s = raw == null ? '' : String(raw);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const toRow = (cells) => cells.map(sanitizeCell).join(',');

const HEADERS = [
  'Date', 'Activity', 'Duration (min)', 'Distance (km)',
  'Exertion (1-10)', 'Session load', 'Calories', 'Source', 'Confirmed',
];

export const buildWorkoutCsv = (logs, typeNameById) => {
  const lines = [HEADERS.join(',')]; // header row is app-controlled, no injection risk
  logs.forEach((l) => {
    const typeId = l.activityTypeID ?? l.ActivityTypeID;
    const name = l.activityName ?? l.ActivityName ?? typeNameById[typeId] ?? `Type ${typeId}`;
    const start = parseServerDate(l.startTime ?? l.StartTime);
    const dateStr = start
      ? start.toLocaleString('en-US', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
        })
      : '';
    lines.push(
      toRow([
        dateStr,
        name,
        l.duration ?? l.Duration ?? '',
        l.distanceKM ?? l.DistanceKM ?? 0,
        l.exertionLevel ?? l.ExertionLevel ?? '',
        l.calculatedLoadForSession ?? l.CalculatedLoadForSession ?? '',
        l.caloriesBurned ?? l.CaloriesBurned ?? '',
        l.sourceDevice ?? l.SourceDevice ?? '',
        (l.isConfirmed ?? l.IsConfirmed) === false ? 'No' : 'Yes',
      ])
    );
  });
  return lines.join('\r\n');
};

/**
 * Fetches the user's logs, builds the CSV, writes it to the cache dir and opens
 * the OS share sheet. Returns the number of workouts exported. Throws with a
 * readable message on failure.
 */
export const exportWorkoutHistory = async (userId) => {
  if (!userId) throw new Error('Not signed in.');

  const [logsRes, typesRes] = await Promise.all([
    getActivityLogsByUser(userId),
    getAllActivityTypes().catch(() => ({ data: [] })),
  ]);
  const logs = Array.isArray(logsRes.data) ? logsRes.data : [];
  if (logs.length === 0) throw new Error('No workouts to export yet.');

  const typeNameById = {};
  (Array.isArray(typesRes.data) ? typesRes.data : []).forEach((t) => {
    typeNameById[t.activityTypeID ?? t.ActivityTypeID] = t.typeName ?? t.TypeName;
  });

  // Newest first for a friendlier export.
  logs.sort((a, b) => {
    const ta = parseServerDate(a.startTime ?? a.StartTime)?.getTime() || 0;
    const tb = parseServerDate(b.startTime ?? b.StartTime)?.getTime() || 0;
    return tb - ta;
  });

  const csv = buildWorkoutCsv(logs, typeNameById);
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `trainwise_workouts_${stamp}.csv`);
  try {
    if (file.exists) file.delete();
  } catch {}
  file.create();
  file.write(csv);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export workout history',
      UTI: 'public.comma-separated-values-text',
    });
  } else {
    throw new Error('Sharing is not available on this device.');
  }
  return logs.length;
};
