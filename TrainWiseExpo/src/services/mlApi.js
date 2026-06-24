import axios from 'axios';

// Client for the Python ML service (ml/app.py), a SEPARATE process from the C#
// backend. It runs on port 8000 on the same PC; the coach screen calls it
// directly over the LAN. The IP MUST track the PC's current LAN IP exactly like
// API_BASE_URL in services/api.js (DHCP can shift it — `ipconfig | findstr IPv4`).
// The Python service must be running (`cd ml && python app.py`) and TCP 8000
// allowed through the firewall on the Private profile, or these calls time out.
const ML_BASE_URL = 'http://192.168.1.117:8000'; // Home LAN (wireless). USB-anywhere alt (school WiFi): http://127.0.0.1:8000 + `adb reverse tcp:8000 tcp:8000`.

const ml = axios.create({
  baseURL: ML_BASE_URL,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

// Normalize errors so callers can show a friendly "analytics offline" state
// instead of a red crash. Mirrors the network-error handling used elsewhere:
// a transient outage (service not started) is expected, not exceptional.
const isOffline = (err) =>
  !err?.response || /network|timeout|econn|abort|fetch/i.test(err?.message || '');

export const mlIsOfflineError = isOffline;

// Performance Manager Chart series: [{ date, fitness, fatigue, form }].
export const getTraineePMC = (traineeId, days = 42) =>
  ml.get(`/api/ml/trainee/${traineeId}/pmc`, { params: { days } });

// ACWR series + thresholds: { series:[{date,acRatio,level}], safeLow, safeHigh, danger }.
export const getTraineeACWR = (traineeId, days = 28) =>
  ml.get(`/api/ml/trainee/${traineeId}/acwr`, { params: { days } });

// Monthly forecast. Omit `month` for the current month (also records a
// snapshot server-side); pass 'YYYY-MM' to view a stored previous month.
export const getTraineeForecast = (traineeId, month) =>
  ml.get(`/api/ml/trainee/${traineeId}/forecast`, {
    params: month ? { month } : undefined,
  });

// Past months (latest snapshot per month) for the month picker:
// { months: [{ monthKey, asOf, projACRatio, projAcuteLoad, riskClass, weeksElapsed }] }.
export const getForecastHistory = (traineeId) =>
  ml.get(`/api/ml/trainee/${traineeId}/forecast/history`);

export const mlHealth = () => ml.get('/health');
