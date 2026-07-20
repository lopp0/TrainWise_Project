/**
 * Central backend switch for the whole app.
 *
 * To move between Local‑LAN and Azure, change ONE line — `BACKEND_MODE` below —
 * then rebuild the APK (the URL is baked in at build time). Both axios clients
 * (services/api.js + api/api.js) import API_BASE_URL from here, so they can
 * never drift out of sync.
 *
 *   'local' → your PC's C# backend over WiFi (free; PC + phone same network).
 *   'azure' → the hosted Azure backend (works anywhere; burns Azure vCores).
 *
 * Local‑LAN checklist (see CLAUDE.md "Mode B"):
 *   1. Run the C# API in VS 2022 bound to http://0.0.0.0:5249 (not localhost).
 *   2. Firewall: allow inbound TCP 5249 on the Private profile.
 *   3. Local SQL Express has every migration run (incl. 2026-06-28 + 2026-07-02).
 *   4. Set env vars JWT_KEY (any ≥32 chars) so login can mint tokens locally.
 *   5. Phone + PC on the same WiFi; verify the IP below with `ipconfig`.
 */
export const BACKEND_MODE = 'local'; // 'local' | 'azure'  ← flip this to switch

// PC LAN IP for local mode. DHCP can change it — re-check with
// `ipconfig | findstr IPv4` and update here if API calls start timing out.
const LOCAL_PC_IP = '192.168.68.51';

const AZURE_URL = 'https://trainwise01-api-djcfcvcedth8hjgp.israelcentral-01.azurewebsites.net/api';
const LOCAL_URL = `http://${LOCAL_PC_IP}:5249/api`;

export const API_BASE_URL = BACKEND_MODE === 'azure' ? AZURE_URL : LOCAL_URL;

// Handy for the ML service (port 8000, always local) to reuse the same IP.
export const LOCAL_ML_URL = `http://${LOCAL_PC_IP}:8000`;
