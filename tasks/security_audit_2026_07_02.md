# TrainWise — Security Audit (2026-07-02)

Scope: ASP.NET Core 8 API (`TrainWise/`), Expo/RN client (`TrainWiseExpo/`), Python ML service (`ml/`).
Focus areas requested: **Authentication & Authorization**, **Data ingestion / sanitisation**, **API endpoint exposure**.
CVSS v3.1 base scores. Status legend: ✅ fixed this pass · 🟡 partially mitigated · 📋 plan only (needs coordinated change).

---

## Summary table

| # | Finding | CVSS | Severity | Status |
|---|---------|------|----------|--------|
| 1 | Live Azure SQL admin password in working-copy `appsettings.json` (weak: `***REDACTED-ROTATE***`) | 9.8 | Critical | 🟡 externalised path added; **rotate + never commit** |
| 2 | No authentication / authorization on any endpoint (IDOR / BOLA everywhere) | 9.1 | Critical | 📋 plan (JWT foundation) + 🟡 partials |
| 3 | Passwords stored & compared in plaintext (`CHAR(8)`) | 8.6 | High | ✅ PBKDF2 hashing (backward-compatible) |
| 4 | Unrestricted file upload → stored XSS / disk-fill (served from `wwwroot`) | 8.1 | High | ✅ `UploadValidator` (magic-byte + size + safe ext) |
| 5 | No rate limiting on auth → brute-force / credential-stuffing / bot signup | 7.5 | High | ✅ `"auth"` fixed-window limiter + global backstop |
| 6 | Verbose errors leak internals (`StatusCode(500, ex.Message)`) | 5.3 | Medium | ✅ generic messages + global handler (Auth/Users/Messages) |
| 7 | CORS `AllowAnyOrigin` + AnyHeader + AnyMethod | 5.3 | Medium | 📋 low-impact today (no cookie auth); tighten with #2 |
| 8 | Weak password policy (min 4 chars) | 4.8 | Medium | ✅ min 8 on create/change |
| 9 | OpenAI key bundled in APK (`EXPO_PUBLIC_OPENAI_API_KEY`) | 6.5 | Medium | 📋 move behind backend proxy |
| 10 | `GET /api/users` returns every user's PII to anonymous callers | 5.3 | Medium | 🟡 flagged (client unused); gate with #2 |
| 11 | User enumeration via distinct login errors | 4.3 | Medium | ✅ single generic "Invalid email or password" |
| 12 | Session blob (userId/profile) in plaintext AsyncStorage; no token | 4.0 | Low | 📋 move to `expo-secure-store` with #2 |
| 13 | Google-login audience checked but no HSTS; Swagger dev-gated (OK) | — | Info | note |

**Positives confirmed:** all SQL is parameterised (stored procs / `SqlParameter`); the one interpolated
query (`BoardDAL.GetLeaderboard`) interpolates only switch-whitelisted fragments, not raw input — **no SQL
injection found**. Google ID tokens are verified server-side (signature/expiry/audience) — no client-trusted
`GoogleId` impersonation. Login response does not include the password (`MapUser` never populates it).

---

## Finding 1 — Live Azure SQL admin password in `appsettings.json` (CVSS 9.8, Critical)

`AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H`

**What:** The working copy of `TrainWise/TrainWise/appsettings.json` contains a usable credential:
`Server=tcp:trainwiseadmin01.database.windows.net;User ID=TrainWiseAdmin;Password=***REDACTED-ROTATE***;...`.
The password is also trivially weak. The Azure SQL server has "Allow Azure services" enabled.

**Attack vector:** Anyone who obtains the file (a mis-`git add -A`, a leaked build artifact, a repo push)
gets full read/write/DROP on the production database — all user PII, health data, and (previously plaintext)
passwords. This is the exact class of leak the project already suffered with the Google key.

**Remediation:**
1. **Rotate the password now** in the Azure portal (SQL server → Reset password) — assume it is burned.
2. Keep the secret **only** in Azure App Service → Configuration → Connection strings (`DefaultConnection`,
   type `SQLAzure`), injected as env var. `DBservice.Connect()` now reads env vars first (✅ applied), so the
   committed `appsettings.json` can hold just the local `Integrated Security=True` string.
3. **Never stage this file.** Follow the CLAUDE.md safe-push checklist: `git add -A` →
   `git restore --staged TrainWise/TrainWise/appsettings.json` → verify with `git show <commit>:...`.
4. Give the SQL login least privilege (a data-plane user with CRUD only, not the server admin).

> Not edited automatically — it is the user's local Azure config (per the project rule). It must be handled
> by rotation + config, not by rewriting the file.

---

## Finding 2 — No authentication / authorization (CVSS 9.1, Critical)

`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:L`

**What:** `Program.cs` calls `app.UseAuthorization()` with **no authentication scheme registered** and there
is **not a single `[Authorize]` attribute** in the codebase. Every endpoint is anonymous. User identity is a
plain integer taken from the route/body and trusted (`PUT /api/users/{id}`, `DELETE /api/users/{id}`,
`GET /api/messages/conversation/{a}/{b}`, `POST /api/messages` with a client-set `SenderID`,
`/api/users/{id}/measurements`, `/api/board/{postId}?userId=`, …).

**Attack vector (Broken Object-Level Authorization / IDOR):**
- Read anyone's private DMs: `GET /api/messages/conversation/5/9`.
- Impersonate anyone in chat: `POST /api/messages { "senderID": 9, ... }`.
- Modify/delete any account: `PUT/DELETE /api/users/{anyId}`.
- Read/alter anyone's health data (weight, injuries, load).
- Enumerate all users' PII: `GET /api/users`.
All with `curl`, no credentials.

**Remediation (plan — cannot be flipped on live without a coordinated client change, which is why it's 📋):**
Add JWT bearer auth and per-resource ownership checks. Sketch:

```csharp
// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o => o.TokenValidationParameters = new TokenValidationParameters {
        ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = cfg["Jwt:Issuer"], ValidAudience = cfg["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(cfg["Jwt:Key"]!))  // Jwt:Key from Azure config, never source
    });
builder.Services.AddAuthorization();
// ...
app.UseAuthentication();
app.UseAuthorization();

// AuthController.Login: on success, return a signed JWT with sub = UserID.
// ControllerBase helper:
protected int CallerId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
protected bool Owns(int routeUserId) => CallerId == routeUserId;
// every user-scoped action:
if (!Owns(id)) return Forbid();
```

Client: store the JWT in `expo-secure-store`, attach `Authorization: Bearer` via an axios interceptor in
BOTH `src/api/api.js` and `src/services/api.js`. `[AllowAnonymous]` only on login/signup/forgot/google-login.

**Partials applied now (🟡, don't need tokens):**
- Login no longer enumerates accounts (Finding 11).
- Message send / measurements / posts still trust the caller id — **documented as 🔐 in `feature_backlog.md`**
  so every future feature adds the ownership check, and existing endpoints get it when the JWT layer lands.

---

## Finding 3 — Plaintext passwords (CVSS 8.6, High) ✅ FIXED

`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`

**What:** `Users.Password` was `CHAR(8)`; `sp_LoginUser` compared `Email=@Email AND Password=@Password` in
SQL. Passwords were stored in cleartext and capped at 8 characters. Combined with Finding 1, a DB leak =
instant full-credential compromise (and password reuse across sites).

**Fix applied:**
- New `BL/PasswordHasher.cs` — PBKDF2 (SHA-256, 100k iterations, 128-bit random salt), BCL-only (no NuGet).
  Format `pbkdf2$<iter>$<salt>$<hash>`; constant-time compare.
- Signup (`UserBL.Create`) hashes before insert. Change-password (`UserDAL.ChangePassword`) verifies current
  (legacy-plaintext aware) and stores a hash.
- Login rewired (`UserLoginBL.Login` + `UserDAL.GetUserByEmail`/`GetStoredPasswordHash`/`SetPasswordHash`):
  fetch by email, verify in C#, and **verify-and-upgrade** legacy plaintext rows to a hash on next login.
- `sql/2026-07-02_security_hardening.sql` widens `Users.Password` → `NVARCHAR(200)` and updates
  `sp_InsertUser` (@Password `CHAR(8)` → `NVARCHAR(200)`). **Run this on local + Azure BEFORE deploying the
  code** — otherwise a hash truncates to 8 chars and new logins fail. Backward-compatible for existing rows.

---

## Finding 4 — Unrestricted file upload → stored XSS (CVSS 8.1, High) ✅ FIXED

`AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:L`

**What:** `POST /api/users/{id}/upload` and `POST /api/messages/upload` took the extension straight from the
client filename, with no content-type/magic-byte check and no size cap, then wrote under `wwwroot`, which
`app.UseStaticFiles()` serves publicly. Uploading `x.html`/`x.svg` yields **stored XSS on the API origin**;
large/many files fill the disk (DoS).

**Fix applied:** `BL/UploadValidator.TryValidateImage` — 6 MB cap, sniffs magic bytes (JPEG/PNG/GIF/WebP),
and returns a **server-derived** extension (client filename ignored). Wired into both upload endpoints. Real
images are unaffected. (No board upload endpoint exists — board posts reference an already-uploaded path.)

---

## Finding 5 — No rate limiting on auth (CVSS 7.5, High) ✅ FIXED

`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N` — enables offline-free brute force / credential stuffing / bot signup.

**Fix applied:** .NET 8 built-in rate limiter (no package). A `"auth"` fixed-window policy (10 req/min/IP) on
`AuthController`, `Users.Create`, `Users.ChangePassword`, `Users.GoogleLogin`, plus a global 300 req/min/IP
backstop. `app.UseRateLimiter()` added. Tune limits as needed; add the same to #110/#114 when built.

> The reCAPTCHA verifier is **fail-open** by design (allows signup when `RECAPTCHA_SECRET` is unset) — this
> is intentional for the demo but means the CAPTCHA is not a real control until the secret + a real site key
> are configured. Documented, not "fixed" (behaviour is deliberate).

---

## Finding 6 — Verbose error leakage (CVSS 5.3, Medium) ✅ FIXED (sensitive controllers)

Controllers returned `StatusCode(500, ex.Message)`, exposing SQL/exception text. Added a global
`UseExceptionHandler` returning a generic JSON error, and changed the `catch(Exception)` → 500 branches in
Auth/Users/Messages to a generic string (validation `ArgumentException` → `BadRequest(msg)` is safe and kept).
**Follow-up (mechanical):** apply the same generic-500 change to the remaining ~15 controllers.

---

## Findings 7–13 (Medium/Low/Info)

- **7 CORS `AllowAnyOrigin`:** low impact today because there's no cookie/session auth (an attacker can hit
  the API directly with curl anyway). Once JWT lands, restrict to known origins via a named policy reading
  `Cors:AllowedOrigins` from config. Native app is unaffected either way.
- **8 Weak password policy:** ✅ min length raised to 8 on create/change (login unaffected; legacy short
  passwords still work until changed).
- **9 OpenAI key in APK:** `EXPO_PUBLIC_OPENAI_API_KEY` is bundled in plaintext. For anything beyond the demo,
  proxy the OpenAI call through the backend and keep the key in Azure config. Don't distribute the APK publicly.
- **10 `GET /api/users` PII dump:** returns all users to anyone; the client doesn't use it. Gate behind auth
  (admin-only) or remove. Flagged.
- **11 User enumeration:** ✅ login now returns one generic message for unknown-email and wrong-password.
- **12 Client session storage:** the user blob sits in plaintext AsyncStorage with no token. Move the (future)
  JWT to `expo-secure-store`; don't persist sensitive fields.
- **13 Info:** add HSTS in production; Swagger is dev-gated (fine for security; CLAUDE.md prefers it on for
  demo triage — that's a deliberate trade-off, not a vuln).

---

## Files changed this pass

- `BL/PasswordHasher.cs` (new), `BL/UploadValidator.cs` (new)
- `BL/UserBL.cs`, `BL/UserLoginBL.cs`, `DAL/UserDAL.cs` (hashing + login rewire)
- `DAL/DBservice.cs` (env-var config)
- `Program.cs` (rate limiter + global exception handler)
- `Controllers/AuthController.cs`, `Controllers/UsersController.cs`, `Controllers/MessagesController.cs`
  (rate-limit attrs, generic 500s, upload validation, no user enumeration)
- `sql/2026-07-02_security_hardening.sql` (new — **run on both DBs before deploy**)
- `tasks/feature_backlog.md` (per-feature security requirements)

Build: `dotnet build` → 0 errors (pre-existing nullable warnings only).

## Doc-sync follow-up (per CLAUDE.md)
Update on `main` when merging: `docs/SECURITY.md` (hashing, upload validation, rate limiting, DB-secret
externalisation, auth roadmap) and `docs/SETUP.md` (new migration in run-order).

---

# Round 2 — deeper pass (additional findings the first pass missed)

Focus of this pass: the **Python ML service** (`ml/` — a second backend not covered above), a
re-audit of the round-1 fixes, and business-logic / integrity issues.

| # | Finding | CVSS | Severity | Status |
|---|---------|------|----------|--------|
| 14 | ML service: **no auth** → anyone on the LAN reads any trainee's health analytics (IDOR) | 7.5 | High | 📋 needs auth (LAN-scoped today; internet-facing if `ml/` is ever deployed) |
| 15 | ML `/forecast`: an **unauthenticated GET writes a `MonthlyForecasts` row every call** → storage-exhaustion DoS + history pollution | 6.5 | Medium | 📋 (make the write authenticated / idempotent per day) |
| 16 | ML **unbounded `?days=`** → `pd.date_range` of millions of days = OOM DoS | 6.5 | Medium | ✅ clamped 1..400 |
| 17 | ML endpoints returned **`str(exc)`** to the client (leaks SQL/DB name/paths) | 5.3 | Medium | ✅ generic error + server log |
| 18 | ML **`joblib.load` (pickle) of model files** = arbitrary-code exec if the models dir is ever attacker-writable / a model is fetched untrusted | 5.6 | Medium | 📋 documented (load only trusted, integrity-checked artifacts) |
| 19 | ML **`Access-Control-Allow-Origin: *`** on a `0.0.0.0`-bound service | 4.3 | Low | 📋 (drop CORS or restrict; RN doesn't need it) |
| 20 | **Login timing oracle I introduced** in round 1 (fast path when email unknown) | 5.3 | Medium | ✅ equalised with a dummy-hash PBKDF2 verify |
| 21 | **Guessable public media URLs** (`{id}_{ticks}` / `chat_{ticks}` under public `wwwroot`) | 5.3 | Medium | ✅ GUID filenames (see note) |
| 22 | **Board delete "own posts only" is bypassable** — ownership is checked against the *client-supplied* `userId` | 6.5 | Medium | 📋 fix with auth (id from JWT `sub`, not query) |
| 23 | **Push-token hijack** — `PUT /api/users/{id}/pushtoken` unauth: point a victim's token at your device (receive their pushes) or wipe it | 5.4 | Medium | 📋 needs ownership check |
| 24 | **Client-supplied `CalculatedLoadForSession`** — trusted by leaderboard + ML; a client can inflate/deflate load (games ranking, and can hide overtraining — undermines the injury-prevention core) | 4.3 | Low | 📋 recompute server-side from `duration × exertion` |
| 25 | **Unbounded pagination/`limit`** on board feed + leaderboard | 4.0 | Low | ✅ clamped (feed 1..100, leaderboard 1..200) |
| 26 | **Role self-assertion at signup** — client sets `IsCoach`/`IsTrainee`; with no authz, anyone can register as a coach | 3.7 | Low | 📋 (fine once per-object authz exists; note it) |
| 27 | **No email verification at signup (#114 unbuilt)** — a password account can be created for an email you don't own; enables the Google-link takeover edge | 3.7 | Low | 📋 build #114 |
| 28 | `AllowedHosts: "*"`, no HSTS | — | Info | 📋 note |

### 14–19 — Python ML service (`ml/`)
The coach analytics/forecast is a **separate Flask backend** with its own exposure, and it was not part of
the round-1 C# review. Positives: **all SQL is parameterised** (`db.query_df(sql, [params])` with `?`), and
`app.run(debug=False)` (no Werkzeug-debugger RCE). Problems:
- **No authentication and IDOR (14):** `GET /api/ml/trainee/<id>/pmc|acwr|forecast` returns any trainee's
  training-load, fitness/fatigue, and injury-derived risk for any `id`, to anyone who can reach port 8000.
  Today that's LAN-only, but the roadmap's "deploy `ml/` to Azure" makes it internet-facing — **add a shared
  secret / the same JWT as the C# API and an ownership/coach-link check before that migration.**
- **Side-effecting unauthenticated GET (15):** every current-month `/forecast` call runs
  `_write_snapshot` → an INSERT into `MonthlyForecasts`. Unauthenticated + unthrottled = unbounded row
  growth. Make the write require auth and/or dedupe to one snapshot per trainee per day.
- **`days` DoS (16) ✅** and **`str(exc)` leak (17) ✅** fixed; a `?month=` shape guard was added.
- **Pickle deserialization (18):** `joblib.load(forecast_model.pkl / risk_model.pkl)` executes any code
  embedded in the file. Safe while the pkl is generated locally by the notebook and the dir isn't writable
  by others — but **never load a model received over the network or from an untrusted path**; when models
  move to blob storage (cloud-ML roadmap) verify a hash/signature first.

### 20 — Login timing oracle (self-review of the round-1 fix) ✅
My round-1 login rewrite returned immediately when the email was unknown but ran full PBKDF2 (100k
iterations) when it existed — a measurable time difference re-enabling user enumeration despite the identical
error text. Fixed: `PasswordHasher.DummyHash` + always verifying (against the dummy when the account/hash is
absent) so both paths cost the same.

### 21 — Guessable public media URLs ✅ (with caveat)
Upload names were time-based (`DateTime.UtcNow.Ticks`), so a chat/profile image URL could be found by
scanning a narrow timestamp window against the public `wwwroot/images`. Now `Guid.NewGuid("N")` → not
enumerable. **Caveat / stronger fix:** anything genuinely private (chat images, and the future injury/medical
photos of #124/#155) should be served through an **authorised endpoint**, not from public static files —
unguessable ≠ access-controlled. Existing already-uploaded files keep their old predictable names.

### 22–24 — Business-logic / integrity
- **22 Board delete:** `DELETE /api/board/{postId}?userId=` checks that the post belongs to the *supplied*
  `userId`. Since the caller chooses that value, passing the real owner's id deletes their post. The check
  only becomes real when the id comes from the authenticated principal (JWT `sub`), not the query string.
  Same pattern applies to every "owner id in the request" endpoint.
- **23 Push-token hijack:** unauth `PUT /{id}/pushtoken` lets an attacker set another user's `PushToken` to
  their own device (silently receive that user's push notifications — an info-disclosure channel) or clear
  it (deny notifications). Needs the ownership check.
- **24 Client-authored load:** the app computes `CalculatedLoadForSession = duration × exertion` on the
  client and POSTs it; the leaderboard and the ML forecast trust it verbatim. Beyond leaderboard gaming, a
  client under-reporting load can suppress the very overtraining/ACWR warnings that are TrainWise's purpose.
  Recompute it server-side in `ActivityLogBL` from the (validated) duration + exertion instead of trusting
  the client value.

### 26–28 — Lower severity
- **26** Signup accepts client `IsCoach/IsTrainee` (by design — the role picker). Harmless once per-object
  authorization exists; until then it compounds the no-authz problem (self-serve coach). `UpdateUserRequest`
  correctly does NOT let an update flip the role (verified).
- **27** No signup email verification (#114): a password account can be registered for an unowned email.
  Combined with Google account-linking by email, the true owner of that Google address could later link+take
  over. Build #114 with the hashed-code rules already specced.
- **28** `AllowedHosts: "*"` (set a real host list in prod) and no HSTS header (add `app.UseHsts()` in
  production alongside the existing HTTPS redirect).

## Round 2 files changed
- `BL/PasswordHasher.cs` (`DummyHash`), `BL/UserLoginBL.cs` (constant-time login)
- `Controllers/UsersController.cs`, `Controllers/MessagesController.cs` (GUID upload names)
- `Controllers/WorkoutBoardController.cs` (pagination/limit clamps)
- `ml/app.py` (days clamp, generic errors, `?month=` shape guard)

Build: C# `dotnet build` → 0 errors; ML `py_compile` of all modules → OK.

---

# Round 3 — the auth foundation (BUILT)

Addresses the root cause of Finding 2 (and, transitively, 10/22/23). Delivered as a **two-stage,
non-breaking rollout** so the currently-installed APK keeps working.

## What was built
**Authentication (identity):**
- `BL/JwtService.cs` — issues an HS256-signed JWT (`uid`, `sub`, role flags, email/name, expiry).
  Key/issuer/audience/expiry/enforce from env vars (`JWT_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`,
  `JWT_EXPIRY_DAYS`, `AUTH_ENFORCE`). Dev fallback: a random per-process key if `JWT_KEY` is unset (logs a
  warning; **prod must set a fixed `JWT_KEY`** or tokens die on restart).
- `Program.cs` — `AddAuthentication().AddJwtBearer(...)` validating issuer/audience/lifetime/signature;
  `app.UseAuthentication()` before `UseAuthorization()`.
- Tokens issued on **login** (`{ token, user }`), **signup** (`{ userID, token }`), **google-login**
  (`{ token, user }`); those endpoints marked `[AllowAnonymous]`.

**Authorization (ownership):**
- `Controllers/BaseApiController.cs` — `CallerId` (from the verified `uid` claim), `CallerMayAct(id)` and
  `CallerMayActEither(a,b)`. The gate is **safe pre-enforcement**: allows when no token is present (old
  client), denies when a token is present but belongs to a different user (updated client is protected
  immediately).
- Ownership checks applied to the high-value endpoints: **Users** (update, delete, upload, equip, pushtoken,
  baseline, measurements get/add, change-password), **Messages** (send/conversation/seen/unread/typing/
  react/reactions — no spoofing SenderID, no reading others' threads), **Board** (create/delete/like/kudos/
  optin — closes the delete-anyone's-post bypass, Finding 22).

**Client (`TrainWiseExpo`):**
- `src/api/authToken.js` — in-memory token + AsyncStorage persistence.
- Bearer interceptor on **both** axios clients (`api/api.js`, `services/api.js`) + the two raw-`fetch`
  uploads. `AuthContext` captures the token on login/google, restores it on bootstrap, clears it on logout.
  Tolerates the old bare-user response shape.

## The rollout switch (`AUTH_ENFORCE`)
- **Now (default `AUTH_ENFORCE` unset/false):** the server validates tokens when sent but does NOT require
  them; the updated client sends tokens and is ownership-checked; **old installed APKs keep working.** Zero
  breakage.
- **Later (set `AUTH_ENFORCE=true` in Azure App Service config):** every endpoint without `[AllowAnonymous]`
  requires a valid token — tokenless callers get 401. Flip this **after** the new APK is built, installed,
  and login is confirmed.

## Still open after Round 3 (documented, not yet done)
- **Ownership on the remaining controllers** (ActivityLog, Calendar, Coach, CoachTrainee, Social, Gyms,
  Records, DailyLoad, UserDevices, InjuryReport, …). Once `AUTH_ENFORCE=true` these require *a* login, but a
  logged-in user could still pass another `id` — extend `BaseApiController` checks to each (mechanical).
- **`GET /api/users` (Finding 10)** still returns all users; gate to admin/remove.
- **ML service (Findings 14/15)** has no token check — add the same JWT (or a shared secret) before deploying
  `ml/` to Azure.
- **Client token storage** → move from AsyncStorage to `expo-secure-store`.
- **`Jwt`/refresh**: 30-day non-refresh token (documented trade-off); add refresh + shorter expiry later.

## Round 3 files
- `BL/JwtService.cs` (new), `Controllers/BaseApiController.cs` (new)
- `Program.cs`, `Controllers/AuthController.cs`, `Controllers/UsersController.cs`,
  `Controllers/MessagesController.cs`, `Controllers/WorkoutBoardController.cs`, `TrainWise.csproj`
- `TrainWiseExpo/src/api/authToken.js` (new), `src/api/api.js`, `src/services/api.js`, `src/api/AuthContext.js`

Build: C# `dotnet build` → 0 errors; changed JS files parse via `@babel/parser`.

---

# Round 4 — ownership checks extended across the remaining controllers

With `AUTH_ENFORCE=true` confirmed working in production, the ownership gate (`CallerMayAct` /
`CallerMayActEither`) was extended to the self-scoped endpoints on the rest of the API so a *logged-in*
user can no longer act on another user's data by passing a different id.

**Now guarded (self-only; verified in the client to only ever be called with the caller's own id):**
- **SocialController** — presence heartbeat, location update, share-location, nearby, mini-profile (viewer),
  send friend request, friends list, pending requests, remove friend, send coach offer, coach offers
  (trainee/sent). Stops spoofed friend/coach requests, fake presence, and reading others' friend lists.
- **DailyLoadController** — `GetByUser`, `calculate` (personal load dashboard).
- **ActivityLogController** — `Create` (log a workout only for yourself).
- **InjuryReportController** — `Create` (report an injury only for yourself).
- **UserDevicesController** — get/create/update (your devices).
- **UserGoalsController** / **UserActivityPreferencesController** — add/remove (your goals/prefs).
- **RecordsController** — `check` (re-evaluate your PRs).
- **CoachController** — `by-user/{userId}`, `for-trainee/{userId}` (your own coach records).

**Deliberately left OPEN (legitimately cross-user, or keyed by a non-user id) — documented, need a
"self-OR-linked-coach" or resource-owner lookup to secure without breaking a feature:**
- **ActivityLog** `GetByUser` (coach drill-down reads a trainee's workouts via this), `Update`/`SetNotes`/
  `SoftDelete` (keyed by ActivityID — need an owner lookup).
- **Calendar** all endpoints (a coach can read/create a trainee's planned workouts — `CreatedByCoach`,
  `targetUserId`); `Update`/`Delete`/`Complete` are keyed by planId.
- **InjuryReport** `GetByUser`/`active` (coach may view a trainee's injuries), pain logs + `recover`
  (keyed by injuryId).
- **Records** `Get` (achievements may be shown on other users' profiles).
- **Social** `RespondFriendRequest`/`RespondCoachOffer` (keyed by friendship/offer id — the BL must check
  the caller is the addressee).
- **Coach** `{coachId}/trainees`, `{coachId}/trainees/{userId}/load` (keyed by CoachID, not UserID) and
  **CoachTrainee** connect/disconnect — need a coach-identity mapping.
- **`GET /api/users`** (all-users PII) and the **read reference endpoints** (activity types, injury types,
  goals, gyms) — the latter are non-sensitive lookups, fine to leave.

Deploy: this round is **backend-only** — re-publish the C# API to Azure (VS 2022 → Publish). No APK rebuild
needed (the client already sends the token). `AUTH_ENFORCE` is already on, so the new checks go live on
publish. Build: `dotnet build` → 0 errors.

---

# Round 5 — self-or-linked-coach, GET /users lockdown, ML service auth

Closes the last cross-user (IDOR) gaps that were deliberately left open in Round 4, plus the two
Round-2/3 open items (#10 GET /users, #14 ML auth).

## Self-OR-linked-coach (the coach-viewable reads)
`BaseApiController` gained `CallerOwnsOrCoaches(traineeUserId)` (self, or a coach the trainee is linked to
via `CoachTrainees`→`Coaches`) and `CallerOwnsCoachId(coachId)` (caller owns that `Coaches.CoachID`).
Applied so a logged-in user can no longer read another user's data by passing their id, WITHOUT breaking
coaching:
- **ActivityLog** `GetByUser`, **InjuryReport** `GetByUser`/`active`, **Calendar** `Get`/`Create`
  → `CallerOwnsOrCoaches` (self or their linked coach; calendar create supports coach-assigned plans).
- **Coach** `{coachId}/trainees`, `{coachId}/trainees/{userId}/load` → `CallerOwnsCoachId` (coach only).
- **CoachTrainee** `connect`/`disconnect` → coach OR trainee (verified in the client that the TRAINEE side
  disconnects via MyCoachScreen, so a coach-only check would have broken it).

## GET /api/users (Finding 10) ✅
Now returns **403** — no screen uses it and there's no admin role; re-open behind an admin check if an admin
console is ever built.

## ML service auth (Finding 14) ✅ (gated, default OFF)
- `ml/auth.py` (new): validates the SAME JWT the C# API issues (shared `JWT_KEY`, HS256, iss/aud/exp) and a
  `may_view(uid, traineeId)` = self or linked coach (queries `CoachTrainees`/`Coaches`). PyJWT is imported
  **lazily** so the service still starts without it.
- `ml/app.py`: a `before_request` guard enforces token + ownership **only when `ML_AUTH_ENFORCE=true`**;
  `/health` stays public. Default off ⇒ no behaviour change to the running local service.
- `ml/config.py`: `JWT_KEY` / `JWT_ISSUER` / `JWT_AUDIENCE` / `ML_AUTH_ENFORCE` from env.
- `requirements.txt`: `PyJWT` (only needed once enforcement is on).
- Client `services/mlApi.js`: attaches the bearer token to ML requests (interceptor).

**To activate ML auth (optional, when you want it):** on the PC running `ml/app.py`, set env vars
`JWT_KEY` (the EXACT value used on Azure), `ML_AUTH_ENFORCE=true`, then `pip install PyJWT` and restart the
service. The app already sends the token, so the coach analytics screen keeps working; other LAN devices get
401/403. Until you do this, the ML service behaves exactly as before.

## Still open (documented)
- Rotate the Azure SQL password (`***REDACTED-ROTATE***`); move the OpenAI key server-side.

Deploy: C# is **backend-only** (re-publish to Azure). ML changes are **default-inert** — no action needed
unless you choose to enable ML auth. Build: C# 0 errors; all `ml/*.py` compile; `mlApi.js` parses.

---

# Round 6 — resource-id-keyed ownership (the last IDOR class) ✅

Closed the endpoints keyed by a RESOURCE id (not a user id), which a valid token could otherwise use to
edit/delete/annotate/respond to anyone's row by guessing the id. Each now looks up the row's owner first.

**New owner-lookup helpers** (parameterized inline SQL in the DAL + BL passthroughs):
- `ActivityLogDAL/BL.GetOwnerUserId(activityId)` → `ActivityLogs.UserID`
- `CalendarDAL/BL.GetOwnerUserId(planId)` → `PlannedWorkouts.UserID`
- `InjuryReportDAL/BL.GetOwnerUserId(injuryId)` → `InjuriesReports.UserID`
- `SocialDAL/BL.GetFriendshipParties(friendshipId)` → `(RequesterID, AddresseeID)`
- `SocialDAL/BL.GetCoachOfferParties(offerId)` → `(CoachUserID, TraineeUserID)`

**Gated (owner looked up, then 404 if missing / 403 on mismatch):**
- **ActivityLog** `Update`, `SetNotes`, `SoftDelete` → self-only (`CallerMayAct`); `GetNotes` → self-or-coach.
- **Calendar** `Update`, `Delete`, `Complete` → self-or-coach (coach can edit assigned plans).
- **InjuryReport** `MarkRecovered`, `AddPainLog` → self-only; `GetPainLogs` → self-or-coach.
- **Social** `RespondFriendRequest` → either party (requester/addressee); `RespondCoachOffer` → either party
  (coach/trainee).

Directly protects the #124 notes and #127 pain-log work. Build: `dotnet build` → 0 errors. Backend-only
(re-publish to Azure; no APK rebuild).
