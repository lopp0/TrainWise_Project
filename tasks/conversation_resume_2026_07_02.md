# Session resume — 2026-07-02 — Security audit + auth foundation

> Handoff for a future Claude Code session. This session performed a full security audit of TrainWise
> and built + deployed an authentication/authorization foundation. Read `CLAUDE.md` and
> `tasks/lessons.md` first, then this. Full technical detail (findings, CVSS, remediation, every file
> changed) lives in **[tasks/security_audit_2026_07_02.md](security_audit_2026_07_02.md)** — this file
> is the narrative + current-state summary.

## What the user asked for
A comprehensive security audit (auth/authorization, data ingestion, API exposure) of the whole codebase
**including** securing the not-yet-built features in `tasks/feature_backlog.md`, then to actually FIX the
issues, then to build the auth "foundation", then extend it. It was done in rounds; each round is a section
in the audit doc.

## Current security state (as of end of session) — MOSTLY DONE + DEPLOYED
The app was moved from "no auth at all" to a working JWT + per-object-ownership system, **live in
production with `AUTH_ENFORCE=true`** on Azure. The user confirmed the app works after enabling it.

### Fixed + deployed
- **Password hashing** (PBKDF2, `BL/PasswordHasher.cs`) — backward-compatible verify-and-upgrade from the
  old plaintext `CHAR(8)`. Login was rewired (`UserLoginBL` fetches by email, verifies in C#, upgrades
  legacy rows). **Required migration `sql/2026-07-02_security_hardening.sql` was run** (widens
  `Users.Password` → NVARCHAR(200), fixes `sp_InsertUser`). Constant-time login (no user-enumeration timing).
- **JWT auth foundation** — `BL/JwtService.cs` issues HS256 tokens on login/signup/google-login
  (`{ token, user }`); `Program.cs` validates them; `Controllers/BaseApiController.cs` holds the ownership
  helpers. Enforcement gated by env var **`AUTH_ENFORCE`** (now `true` in Azure). Signing key from env var
  **`JWT_KEY`** (set in Azure). Client: `src/api/authToken.js` + bearer interceptors on both axios clients,
  the two raw-`fetch` uploads, and `mlApi.js`; `AuthContext` captures/restores/clears the token.
- **Per-object ownership checks** on Users, Messages, Board, Social, DailyLoad, ActivityLog(create),
  Injury(create), Devices, Goals, ActivityPreferences, Records(check), Coach lookups — and the
  **self-or-linked-coach** gate (`CallerOwnsOrCoaches`) on the coach-viewable reads (trainee workouts,
  injuries, calendar) + `CallerOwnsCoachId` on coach-id endpoints. `GET /api/users` now 403s.
- **File-upload hardening** (`BL/UploadValidator.cs`: magic-byte + size + server-derived extension) on both
  upload endpoints; GUID (non-enumerable) upload filenames.
- **Rate limiting** on auth endpoints (`Program.cs`, built-in .NET 8 limiter) + global backstop.
- **Error-leak fix** (generic 500s + global handler) on Auth/Users/Messages.
- **DB secret externalisation** — `DBservice.Connect()` reads env vars first, so the Azure SQL password can
  live in Azure config instead of `appsettings.json`.
- **Python ML service** — DoS/error fixes (clamp `days`, generic errors, `?month=` guard) AND optional JWT
  auth (`ml/auth.py`, gated by **`ML_AUTH_ENFORCE`**, default OFF; PyJWT lazy-imported so nothing breaks).

### Backlog security (`tasks/feature_backlog.md`)
A big "🔒 Security requirements" section was added at the top: baseline rules for every feature + per-feature
🔐 callouts (reset codes hashing, Stripe webhook signature, prompt-injection, deep-link validation, video
upload limits, PII/privacy, etc.). Read it before building anything from that backlog.

## The rollout model (IMPORTANT for future sessions)
Auth is a **two-stage switch** so installed APKs never break:
- Server validates tokens when present; `AUTH_ENFORCE` decides if they're REQUIRED.
- `AUTH_ENFORCE=true` is ALREADY LIVE. `[AllowAnonymous]` is on login/signup/google-login/health only.
- Ownership gates (`CallerMayAct` etc.) allow when no token is present (legacy) and deny on a token↔id
  mismatch — safe to add before/after enforcement.

## Still OPEN (documented, not done)
1. ~~Resource-id-keyed endpoints~~ — **DONE (Round 6).** ActivityLog Update/SetNotes/SoftDelete/GetNotes,
   Calendar Update/Delete/Complete, InjuryReport recover/pain-logs, Social Respond* now look up the row's
   owner (`GetOwnerUserId` / `GetFriendshipParties` / `GetCoachOfferParties`) and gate on it.
2. **Rotate the Azure SQL password** `***REDACTED-ROTATE***` (weak; was in `appsettings.json` working copy). The
   working `appsettings.json` still carries a live Azure password — NEVER commit it (git restore --staged).
3. **Move the OpenAI key server-side** (currently `EXPO_PUBLIC_`, baked into the APK).
4. **ML auth is built but OFF** — enable with `JWT_KEY`+`ML_AUTH_ENFORCE=true`+`pip install PyJWT` before
   ever deploying `ml/` to Azure.
5. **Client token → `expo-secure-store`** (currently AsyncStorage).
6. **Doc-sync**: update `docs/SECURITY.md` / `docs/SETUP.md` on `main` when merging (per CLAUDE.md rule).

## How to deploy the remaining backend changes
This session's later rounds are **backend-only** → re-publish the C# API (VS 2022 → Publish). No APK rebuild
(the token-sending client was already built + installed). The password-hashing round DID need the APK +
`sql/2026-07-02_security_hardening.sql` (both done).

## Env vars now expected in Azure App Service config
- `JWT_KEY` (≥32 random chars) — SET. Without a fixed key, tokens die on restart.
- `AUTH_ENFORCE=true` — SET (enforcement live).
- (Existing) `ConnectionStrings__DefaultConnection`, `FIREBASE_CREDENTIALS_JSON`, `GOOGLE_WEB_CLIENT_ID`,
  optionally `RECAPTCHA_SECRET`.
- ML service (local PC only, if enabling): `JWT_KEY` (same value), `ML_AUTH_ENFORCE=true`.

## Key files created this session
- `TrainWise/TrainWise/BL/PasswordHasher.cs`, `UploadValidator.cs`, `JwtService.cs`
- `TrainWise/TrainWise/Controllers/BaseApiController.cs`
- `sql/2026-07-02_security_hardening.sql`
- `TrainWiseExpo/src/api/authToken.js`
- `ml/auth.py`
- `tasks/security_audit_2026_07_02.md` (the full audit — 5 rounds)

## Gotchas learned this session
- `Users.Password` was `CHAR(8)` (plaintext, 8-char cap) — the migration to widen it MUST run before the
  hashing code, or new signups store truncated hashes.
- The coach drill-down reads a trainee's workouts via `getActivityLogs(traineeId)`; the TRAINEE (not the
  coach) disconnects a coach link via MyCoachScreen — so ownership gates on those must be "self-or-coach" /
  "either party", not strict self.
- Browser hitting the Azure API URL now shows **HTTP 401** — that's correct (no token), not a bug.
- After enabling `AUTH_ENFORCE`, users on a pre-token session/APK must reinstall the new APK and **log
  out/in** to get a token (a stale session had none).
