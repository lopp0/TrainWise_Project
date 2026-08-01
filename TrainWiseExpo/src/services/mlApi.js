import axios from 'axios';
import { getAuthToken } from '../api/authToken';

/**
 * Central switch for the Python ML service (ml/app.py) — a SEPARATE process from
 * the C# backend, mirroring the pattern in src/config/backend.js so switching is
 * ONE line. Change `ML_MODE` below, then rebuild the APK (the URL is baked in at
 * build time).
 *
 *   'local'  → the Python service on your PC over WiFi (free; PC + phone same
 *              network; `cd ml && python app.py` running + TCP 8000 open on the
 *              Private firewall profile). Coach analytics / trainee Load Trend /
 *              #174 "My analytics" only work when the PC is on the same WiFi.
 *   'azure'  → the hosted Azure App Service (works anywhere; independent of the
 *              PC being on). Confirmed live 2026-07-21 (/health → db:true).
 *
 * NOTE: this is INDEPENDENT of backend.js's BACKEND_MODE — the C# API and the
 * Python ML service are two separate hosts and switch separately. A mixed combo
 * (C# local + ML azure) works but is odd: if the C# API is home-WiFi-only there's
 * little point in the ML service being reachable from anywhere. Usually keep both
 * on the same mode.
 */
const ML_MODE = 'azure'; // 'local' | 'azure'  ← flip this to switch

// PC LAN IP for local mode. DHCP can shift it — re-check with
// `ipconfig | findstr IPv4` and keep it in sync with LOCAL_PC_IP in
// src/config/backend.js (both point at the same PC).
const LOCAL_PC_IP = '192.168.1.118';

const AZURE_ML_URL = 'https://trainwise-ml-gqb8fvbzhbajfqdx.israelcentral-01.azurewebsites.net';
const LOCAL_ML_URL = `http://${LOCAL_PC_IP}:8000`; // USB-anywhere alt (school WiFi): http://127.0.0.1:8000 + `adb reverse tcp:8000 tcp:8000`.

const ML_BASE_URL = ML_MODE === 'azure' ? AZURE_ML_URL : LOCAL_ML_URL;

const ml = axios.create({
  baseURL: ML_BASE_URL,
  // Azure F1 cold start + serverless SQL wake can take 10-30s on the FIRST
  // request after idle; a 12s cap would falsely trip the "offline" path there.
  // Local is fast, so keep it snappy.
  timeout: ML_MODE === 'azure' ? 35000 : 12000,
  headers: { 'Content-Type': 'application/json' },
});

// Send the bearer token so the ML service can authenticate the caller when
// ML_AUTH_ENFORCE is on (ignored by the service when it's off).
ml.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize errors so callers can show a friendly "analytics offline" state
// instead of a red crash. Mirrors the network-error handling used elsewhere:
// a transient outage (service not started) is expected, not exceptional.
const isOffline = (err) =>
  !err?.response || /network|timeout|econn|abort|fetch/i.test(err?.message || '');

export const mlIsOfflineError = isOffline;

// The device's UTC offset in minutes (same convention as services/api.js) so
// the Python service buckets workouts to the user's LOCAL calendar day.
const tzOffsetMinutes = () => -new Date().getTimezoneOffset();

// Performance Manager Chart series: [{ date, fitness, fatigue, form }].
export const getTraineePMC = (traineeId, days = 42) =>
  ml.get(`/api/ml/trainee/${traineeId}/pmc`, {
    params: { days, tzOffsetMinutes: tzOffsetMinutes() },
  });

// ACWR series + thresholds: { series:[{date,acRatio,level}], safeLow, safeHigh, danger }.
export const getTraineeACWR = (traineeId, days = 28) =>
  ml.get(`/api/ml/trainee/${traineeId}/acwr`, {
    params: { days, tzOffsetMinutes: tzOffsetMinutes() },
  });

// Full load analytics (rolling + EWMA AC ratio series + training summary), same
// shape as the C# LoadAnalyticsBL. Powers the Load-tab Load Trend + Training
// Analysis cards from the ML service (Classic/Smooth toggle reads this).
export const getTraineeAnalytics = (traineeId, days = 56) =>
  ml.get(`/api/ml/trainee/${traineeId}/analytics`, {
    params: { days, tzOffsetMinutes: tzOffsetMinutes() },
  });

// Monthly forecast. Omit `month` for the current month (also records a
// snapshot server-side); pass 'YYYY-MM' to view a stored previous month.
export const getTraineeForecast = (traineeId, month) =>
  ml.get(`/api/ml/trainee/${traineeId}/forecast`, {
    params: month
      ? { month, tzOffsetMinutes: tzOffsetMinutes() }
      : { tzOffsetMinutes: tzOffsetMinutes() },
  });

// Past months (latest snapshot per month) for the month picker:
// { months: [{ monthKey, asOf, projACRatio, projAcuteLoad, riskClass, weeksElapsed }] }.
export const getForecastHistory = (traineeId) =>
  ml.get(`/api/ml/trainee/${traineeId}/forecast/history`);

// What-if simulator (#185): recompute the ACWR with `addSessions` hypothetical
// sessions at `intensity` ('easy'|'medium'|'hard') added this week. Returns
// { addSessions, intensity, sessionLoad, addedLoad, baseline:{acRatio,acute,
// chronic,level,risk}, simulated:{...} }. Debounce the caller — dragging a
// slider must not hammer the service.
export const getTraineeWhatIf = (traineeId, addSessions, intensity = 'medium') =>
  ml.get(`/api/ml/trainee/${traineeId}/whatif`, {
    params: { addSessions, intensity, tzOffsetMinutes: tzOffsetMinutes() },
  });

export const mlHealth = () => ml.get('/health');
