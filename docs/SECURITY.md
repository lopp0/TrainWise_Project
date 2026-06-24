# Security Policy — TrainWise

TrainWise is a student / demo project. This document describes the **actual** security posture (not an
aspirational one), the secret‑handling rules that the project owner is strict about after a past key
leak, and the hardening backlog.

> **Honesty note:** several items below are documented as **gaps**, not features. They are listed so
> they're tracked, not to imply they're solved. See [Hardening backlog](#hardening-backlog).

---

## Reporting

This is a private school project, not a deployed product with users. If you find a security issue,
raise it directly with the project owner — do not open a public issue with reproduction details.

---

## Security architecture (as built)

### Authentication
- **Session‑based, no JWT.** Login is `POST /api/auth/login`; credentials are validated server‑side by
  the `sp_LoginUser` stored procedure. The frontend (`src/api/AuthContext.js`) stores the returned user
  object in `AsyncStorage` and exposes `userId` to the app.
- A **Google sign‑in** endpoint also exists (`POST /api/users/google-login`) alongside the
  `@react-native-google-signin` client package.
- A locally generated `deviceId` (`dev-<timestamp>-<rand>`) is persisted per install.

### Transport
- **Azure mode** is HTTPS end‑to‑end.
- **Local‑LAN mode** is plain HTTP over WiFi (`android:usesCleartextTraffic="true"` is required for
  Android 9+). This is acceptable only on a trusted home LAN for development.

### Data access
- All database access goes through **parameterized stored procedures** via raw ADO.NET
  (`DAL/*.cs` + `DBservice.cs`) — no string‑concatenated SQL, so the primary SQL‑injection surface is
  closed by construction.

### File uploads
- Profile pictures and chat images upload via multipart to `wwwroot/images/` using
  `IWebHostEnvironment.WebRootPath`. Uploads are size‑bounded by an `AbortController` timeout on the
  client; there is **no magic‑byte content sniffing** yet (see [backlog](#hardening-backlog)).

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

### `EXPO_PUBLIC_*` are baked into the APK in plaintext
Any `EXPO_PUBLIC_`‑prefixed var is inlined into the JS bundle at build time, so it ships **in the APK
in clear text**. This is acceptable for the school demo, but:
- **Do not distribute the APK publicly.**
- If the project ever ships beyond demos, proxy these calls through the backend so the key lives only
  server‑side.

### `appsettings.json` is a tracked file that holds a live secret locally
`TrainWise/TrainWise/appsettings.json` is **tracked**, so `.gitignore` can't protect it. Its **working
copy** may carry the live Azure SQL password (`…User ID=<sql-admin>;Password=…`), but the
**committed** version must hold only the clean local string
(`Data Source=…\SQLEXPRESS;…;Integrated Security=True`, no password). A blind `git add -A` would commit
the password. The fix is to always restore‑stage it (below). **Never edit the working file to "clean"
it** — it's the owner's local Azure config.

### Never commit
- `sql/full_data_insert.sql`, `sql/export_all_data.sql` — full live‑DB dumps with **real user emails +
  password‑column values** (already gitignored).
- `Python Course ML/` (unrelated course homework), `tasks/design_backups/` (duplicate source),
  `ml/models/*.pkl` (regenerable by the notebook).
- `TrainWiseExpo/android/` is gitignored wholesale (incl. `google-services.json`), so native secrets
  don't leak.

The repo needs only **schema** (`TWDB.sql` / `TrainWiseV2.sql` / migrations) + `seed_reference_data.sql`
— any `*_data_insert` / `export_all_data` / `*dump*` file is runtime data, not schema.

---

## Safe‑push checklist

Run **every time** before committing/pushing:

1. `git fetch` and compare local vs `origin/<branch>` to scope the push.
2. **Scan the working tree** for secrets with a content search (ripgrep skips gitignored files):
   patterns `AIza` · `sk-` · `AKIA` · `ghp_` · `xox` · `ya29.` · `-----BEGIN` · `private_key` ·
   `client_secret` · `Password=<literal>` · `database.windows.net` · `Data Source=` · `Server=tcp:`.
3. Add any junk / PII / secret files to `.gitignore`.
4. `git add -A`, then **`git restore --staged TrainWise/TrainWise/appsettings.json`** (and any other
   tracked‑with‑local‑secret file).
5. Scan the **committed tree** (not the working tree) — `git grep -nEi "<patterns>" <commit>` — so the
   staged‑out password doesn't give a false alarm. Verify the appsettings exclusion with
   `git show <commit>:TrainWise/TrainWise/appsettings.json` (must show the local string).
6. Only then commit + push to your own feature branch.

> A key leaked to history can only be scrubbed with `git filter-repo --replace-text` + force‑push — and
> must be **rotated regardless**, because public history is forever. Removing a key from the latest file
> does **not** remove it from history.

### Not blocking (present in docs/history, not usable credentials)
- The public Azure **API URL** (baked into the APK anyway).
- The Azure SQL **server hostname + admin username** (useless without the password + the Azure firewall
  allowlist).
- The **demo seed accounts** (`demo1234` on non‑routable `@trainwise.demo` emails in
  `sql/2026-06-08_add_social.sql`) — intentional fake data. Distinguish a usable live credential (block)
  from a throwaway demo on a fake domain (disclose, don't block).

---

## Past incident

**2026‑06‑09 — Google API key leaked via push.** A literal `AIza…` key lived in both `app.json` and
`weatherService.js` and was pushed to GitHub. The pre‑commit scan at the time only looked for `sk-` /
passwords and missed the Google key. Resolution: key moved to `.env`, `app.json` reduced to a
placeholder, native key injected via `app.config.js`, and the scan pattern list expanded (above). The
key was **rotated**, not just deleted from the latest file.

---

## Hardening backlog

Honest list of what is **not** yet done:

- **Password hashing** — the app layer passes the password straight to `sp_LoginUser`; there is no
  salted hash (e.g. BCrypt) visible in the C#/SQL layer. Add salted hashing + verify on login.
- **Token‑based sessions** — replace the AsyncStorage user object with a short‑lived access token +
  refresh.
- **Rate limiting** — no per‑endpoint or global throttle on login / register.
- **File‑upload content sniffing** — validate magic bytes, not just extension/content‑type.
- **Security headers** — add CSP / HSTS / `X-Content-Type-Options` to the API responses.
- **Automated secret scanning** — a `gitleaks` pre‑commit hook + a CI secret‑scan job (today the
  safe‑push checklist is manual). Tracked in the [roadmap](../README.md#roadmap--planned).
- **CodeQL + dependency audits** — no static‑analysis or `npm audit` / `dotnet list package --vulnerable`
  gate yet.
- **CORS** — the API currently uses `AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()`; tighten to a
  known origin list before any real deployment.

See the [README roadmap](../README.md#roadmap--planned) for how these map to planned infrastructure.
