import { parseServerDate } from './serverDate';

/**
 * WhatsApp-style day separators for chat threads.
 *
 * Messages are grouped by LOCAL calendar day (Asia/Jerusalem, matching the rest
 * of the app's display convention) and the first message of each day gets a
 * "Today" / "Yesterday" / date chip above it. Shared by the 1:1 ChatScreen and
 * the event/program group chat so both label days identically.
 */
const TZ = 'Asia/Jerusalem';

// YYYY-MM-DD in the display timezone — the key we group by. Using the localized
// parts (not the raw UTC date) keeps a 00:30 message on the right day.
const dayKey = (raw) => {
  const d = parseServerDate(raw);
  if (Number.isNaN(d.getTime())) return null;
  // en-CA gives ISO-ish YYYY-MM-DD, which sorts and compares cleanly.
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
};

/** Human label for a day: Today / Yesterday / "Mon, 4 Aug" / "4 Aug 2025". */
export const dayLabel = (raw) => {
  const d = parseServerDate(raw);
  if (Number.isNaN(d.getTime())) return '';
  const key = dayKey(raw);
  const now = new Date();
  const todayKey = now.toLocaleDateString('en-CA', { timeZone: TZ });
  const y = new Date(now.getTime() - 86400000);
  const yesterdayKey = y.toLocaleDateString('en-CA', { timeZone: TZ });

  if (key === todayKey) return 'Today';
  if (key === yesterdayKey) return 'Yesterday';

  const sameYear = key?.slice(0, 4) === todayKey.slice(0, 4);
  return d.toLocaleDateString('en-US', {
    timeZone: TZ,
    weekday: sameYear ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
};

/**
 * True when `raw` starts a new day relative to `prevRaw` (so the caller should
 * render a separator above that message). Always true for the first message.
 */
export const startsNewDay = (raw, prevRaw) => {
  if (prevRaw == null) return true;
  const a = dayKey(raw);
  const b = dayKey(prevRaw);
  if (!a) return false;      // unparseable timestamp: don't inject a blank chip
  return a !== b;
};
