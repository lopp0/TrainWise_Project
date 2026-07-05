# Security Policy — TrainWise

TrainWise is a student / demo project. This document describes the **actual** security posture (not an
aspirational one), the secret‑handling rules that the project owner is strict about after a past key
leak, and the remaining hardening backlog. A full, round‑by‑round audit (findings, CVSS, remediation,
files changed) lives in [`tasks/security_audit_2026_07_02.md`](../tasks/security_audit_2026_07_02.md).

---

## Reporting

This is a private school project, not a deployed product with users. If you find a security issue,
raise it directly with the project owner — do not open a public issue with reproduction details.

---

## Security architecture (as built)

### Authentication & authorization
- **JWT bearer auth** (`BL/JwtService.cs`, HS256, signing key from the `JWT_KEY` env var — never
  hardcoded; a random per‑process key is used in dev if unset). Login / signup / google‑login return a
  signed token carrying the verified `uid` + role flags; both axios clients and the two raw‑`fetch`
  uploads attach it as `Authorization: Bearer` (`src/api/authToken.js`).
- **Two‑stage rollout switch (`AUTH_ENFORCE`)** — the server validates tokens whenever present and, once
  `AUTH_ENFORCE=true` in Azure config, **requires** them (tokenless callers get 401). This let already‑
  installed APKs keep working during migration; `[AllowAnonymous]` is only on login / signup /
  google‑login / health.
- **Per‑object ownership checks** (`Controllers/BaseApiController.cs`: `CallerMayAct`,
  `CallerOwnsOrCoaches`, `CallerOwnsCoachId`) stop a logged‑in user from acting on another user's data by
  passing a different id — closing the IDOR / BOLA class across Users, Messages, Board, Social, Calendar,
  ActivityLog, InjuryReport, Records, Devices, Goals, and the coach‑viewable reads. `GET /api/users` now
  returns **403**.
- **Passwords are PBKDF2‑hashed** (`BL/PasswordHasher.cs`: SHA‑256, 100k iterations, 128‑bit random salt,
  constant‑time compare) with **verify‑and‑upgrade** from the old plaintext `CHAR(8)` rows on next login.
  Login is **constant‑time** (a dummy‑hash path when the email is unknown) so it doesn't leak whether an
  account exists, and returns a single generic "Invalid email or password".
- **Google sign‑in** (`POST /api/users/google-login`) uses the **native** `@react-native-google-signin`
  picker. The client sends the Google **ID token**, which the backend **verifies server‑side**
  (`GoogleTokenVerifier` → Google `tokeninfo`, with the token's `aud` checked against our web client ID
  and `email_verified` required). The raw client‑supplied `GoogleId` is **not** trusted.
- **reCAPTCHA on registration** — `POST /api/users` runs `CaptchaVerifier` (Google `siteverify`) before
  creating the user. It is **fail‑open**: if `RECAPTCHA_SECRET` isn't configured, verification is skipped
  so signup still works. The site key in `SignUpFinal.js` is public by design; the secret stays in Azure.
- A locally generated `deviceId` (`dev-<timestamp>-<rand>`) is persisted per install.

### Abuse & error handling
- **Rate limiting** — .NET 8 built‑in limiter: an `"auth"` fixed‑window policy (10 req/min/IP) on login,
  register, change‑password, and google‑login, plus a global 300 req/min/IP backstop.
- **No verbose leaks** — a global exception handler + generic 500s on the sensitive controllers; the real
  exception text is logged server‑side, not returned to the client (validation `ArgumentException` →
  `BadRequest(msg)` is safe and kept).

### Transport
- **Azure mode** is HTTPS end‑to‑end.
- **Local‑LAN mode** is plain HTTP over WiFi (`android:usesCleartextTraffic="true"` is required for
  Android 9+). Acceptable only on a trusted home LAN for development.

### Data access
- All database access goes through **parameterized stored procedures / `SqlParameter`** via raw ADO.NET
  (`DAL/*.cs` + `DBservice.cs`). The one interpolated query (`BoardDAL.GetLeaderboard`) interpolates only
  switch‑whitelisted fragments, not raw input — the audit found **no SQL injection**.

### File uploads
- Profile pictures and chat images upload via multipart to `wwwroot/images/` using
  `IWebHostEnvironment.WebRootPath`, gated by `BL/UploadValidator.cs`: a **6 MB cap**, **magic‑byte
  sniffing** (JPEG / PNG / GIF / WebP), and a **server‑derived extension** (the client filename is
  ignored). Files are stored under **GUID** names so URLs aren't enumerable. (Genuinely private images
  should still move to an authorized endpoint rather than public static files — see [backlog](#hardening-backlog).)

### ML service (Python)
- The coach‑analytics service has **optional JWT auth** (`ml/auth.py`) validating the *same* token the C#
  API issues (shared `JWT_KEY`, HS256, iss/aud/exp) plus a self‑or‑linked‑coach ownership check. It is
  gated by `ML_AUTH_ENFORCE` (default **off**, PyJWT lazy‑imported), so the local service is unchanged
  until you enable it — which you should before ever deploying `ml/` to the internet.

---

## Secrets management

This is the most important section. The project owner is **very** sensitive here after a Google API
key was once leaked via a push.

### Where secrets live
- **Frontend keys** live only in `TrainWiseExpo/.env` (gitignored): the Google key
  (`GOOGLE_MAPS_API_KEY` for native + `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` for JS fetches) and the OpenAI
  key (`EXPO_PUBLIC_OPENAI_API_KEY`).
- The **native Maps key** is injected at build time by `app.config.js` from the env var; `app.json`'s
  `android.config.googleMaps.apiKey` is an **empty placeholder** — never a literal key.

### Server‑side auth secrets (Azure App Service → Configuration)
Read from environment variables on the backend, never hardcoded:
- **`JWT_KEY`** — HS256 signing key (≥ 32 chars). **Must** be a fixed value in Azure, or tokens die on
  every restart. `JWT_ISSUER` / `JWT_AUDIENCE` / `JWT_EXPIRY_DAYS` / `AUTH_ENFORCE` are also env‑driven.
- **`RECAPTCHA_SECRET`** — the reCAPTCHA **secret** key (pairs with the public site key in `SignUpFinal.js`).
  Leave unset to disable verification (fail‑open). Keep it only in Azure config.
- **`GOOGLE_WEB_CLIENT_ID`** *(optional)* — expected audience for Google ID‑token verification. Falls back
  to the public web client ID literal (Firebase project `trainwise-ef6aa`); a web **client ID** is public
  (it ships in the APK), so the fallback is not a secret.

### DB secret is externalized to Azure config
`DBservice.Connect()` reads the connection string from **environment variables first** (Azure App Service
→ Configuration → Connection strings, `DefaultConnection`), so the committed `appsettings.json` can hold
only the clean local `Integrated Security=True` string — the Azure SQL password lives **only** in Azure
config, not in source.

### Android release signing key (local only)
Google Sign‑In requires the app's Android OAuth client (package + **SHA‑1**). The release APK is signed
with a **dedicated keystore** `TrainWiseExpo/android/app/trainwise-release.keystore` (unique SHA‑1). The
keystore **and its passwords** (in `android/app/build.gradle`) live only locally — `TrainWiseExpo/android/`
is gitignored wholesale and `*.keystore` (except `debug.keystore`) is gitignored, so neither is ever
committed. **Back the keystore up** — losing it means you can't sign updates.

### `EXPO_PUBLIC_*` are baked into the APK in plaintext
Any `EXPO_PUBLIC_`‑prefixed var is inlined into the JS bundle at build time, so it ships **in the APK in
clear text** (this includes the OpenAI key — a known backlog item). Acceptable for the school demo, but:
- **Do not distribute the APK publicly.**
- If the project ships beyond demos, proxy those calls through the backend so the key lives only server‑side.

### `appsettings.json` is a tracked file that holds a live secret locally
`TrainWise/TrainWise/appsettings.json` is **tracked**, so `.gitignore` can't protect it. Its **working
copy** may carry the live Azure SQL password (`…User ID=<sql-admin>;Password=…`), but the **committed**
version must hold only the clean local `Integrated Security=True` string. A blind `git add -A` would commit
the password — always restore‑stage it (below). **Never edit the working file to "clean" it** — it's the
owner's local Azure config.

### Never commit
- `sql/full_data_insert.sql`, `sql/export_all_data.sql` — full live‑DB dumps with **real user emails +
  password‑column values** (already gitignored).
- `Python Course ML/` (unrelated course homework), `tasks/design_backups/` (duplicate source),
  `ml/models/*.pkl` (regenerable by the notebook).
- `TrainWiseExpo/android/` is gitignored wholesale (incl. `google-services.json`), so native secrets don't leak.

The repo needs only **schema** (`TWDB.sql` / `TrainWiseV2.sql` / migrations) + `seed_reference_data.sql`
— any `*_data_insert` / `export_all_data` / `*dump*` file is runtime data, not schema.

---

## Safe‑push checklist

Run **every time** before committing/pushing:

1. `git fetch` and compare local vs `origin/<branch>` to scope the push.
2. **Scan the working tree** for secrets (ripgrep skips gitignored files): patterns `AIza` · `sk-` ·
   `AKIA` · `ghp_` · `xox` · `ya29.` · `-----BEGIN` · `private_key` · `client_secret` · `Password=<value>`
   · `database.windows.net` · `Data Source=` · `Server=tcp:` — **and the actual password string itself**
   (a weak reused password can hide in a task doc, not just `appsettings.json`).
3. Add any junk / PII / secret files to `.gitignore`; redact any secret quoted in a doc.
4. `git add -A`, then **`git restore --staged TrainWise/TrainWise/appsettings.json`** (and any other
   tracked‑with‑local‑secret file).
5. Scan the **staged diff** *and* the **committed tree** (`git grep -nEi "<patterns>" <commit>` — scan the
   commit, not the working tree, so the staged‑out password doesn't give a false alarm). Verify the
   exclusion with `git show <commit>:TrainWise/TrainWise/appsettings.json` (must show the local string).
6. Only then commit + push to your own feature branch.

> A key leaked to history can only be scrubbed with `git filter-repo --replace-text` + force‑push — and
> must be **rotated regardless**, because history is forever. Removing a key from the latest file does
> **not** remove it from history.

### Not blocking (present in docs/history, not usable credentials)
- The public Azure **API URL** (baked into the APK anyway).
- The Azure SQL **server hostname + admin username** (useless without the password + the firewall allowlist).
- The public **Google web client ID** and **reCAPTCHA site key** (public by design; the *secret* keys are not).
- The **demo seed accounts** (`demo1234` on non‑routable `@trainwise.demo` emails in
  `sql/2026-06-08_add_social.sql`) — intentional fake data. Distinguish a usable live credential (block)
  from a throwaway demo on a fake domain (disclose, don't block).

---

## Past incidents

- **2026‑06‑09 — Google API key leaked via push.** A literal `AIza…` key lived in `app.json` +
  `weatherService.js` and was pushed. Resolution: key moved to `.env`, `app.json` reduced to a
  placeholder, native key injected via `app.config.js`, scan pattern list expanded, and the key **rotated**.
- **2026‑07‑02 — weak Azure SQL password (`TrainWise01`) in the `appsettings.json` working copy.** Flagged
  by the security audit (Finding 1, CVSS 9.8). The DB secret was externalized to Azure config; the working
  file is kept out of every commit via the checklist above; **the password must still be rotated and
  treated as burned** (see backlog).

---

## Hardening backlog

**Done in the 2026‑07‑02 security pass** (detail: [`tasks/security_audit_2026_07_02.md`](../tasks/security_audit_2026_07_02.md)):
- ✅ PBKDF2 password hashing + verify‑and‑upgrade; constant‑time login; no user enumeration.
- ✅ JWT bearer auth + per‑object ownership checks (`AUTH_ENFORCE` rollout); `GET /api/users` → 403.
- ✅ File‑upload magic‑byte validation + size cap + GUID filenames.
- ✅ Rate limiting on auth + global backstop; generic 500s + global exception handler.
- ✅ Google login verifies the ID token server‑side (audience‑checked); reCAPTCHA scaffold on signup.
- ✅ DB secret read from env (Azure Connection strings) instead of `appsettings.json`.
- ✅ Optional ML‑service JWT (`ml/auth.py`, gated by `ML_AUTH_ENFORCE`); ML DoS/error‑leak fixes.

**Still open (honest list):**
- **Rotate the Azure SQL password** — the old weak password sat in the `appsettings.json` working copy;
  treat it as burned, rotate it in the Azure portal, keep the new one only in Azure config.
- **OpenAI key server‑side** — currently `EXPO_PUBLIC_`, baked into the APK; proxy it through the backend.
- **Client token storage** — move the JWT from `AsyncStorage` to `expo-secure-store`.
- **Refresh tokens** — today a long‑lived (30‑day) non‑refresh token; add refresh + a shorter access expiry.
- **Remaining ownership** — a few resource‑id‑keyed endpoints still need self/owner lookups (tracked in the audit).
- **Security headers / CORS** — add HSTS and a real `AllowedHosts`; tighten CORS from `AllowAnyOrigin`
  once every client sends a token.
- **Email verification at signup** — not yet built (enables a Google‑link takeover edge case).
- **Automated secret scanning + CI** — a `gitleaks` pre‑commit hook + CI secret scan, CodeQL, and
  dependency audits (today the safe‑push checklist is manual). See the [README roadmap](../README.md#roadmap--planned).
