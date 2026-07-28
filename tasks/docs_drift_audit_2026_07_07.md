# TrainWise — Docs-vs-Code Drift Audit + Fix (2026-07-07)

**Handoff / resume document.** Everything from the exhaustive documentation drift audit and
the fixes applied. Self-contained so it can be pasted into a fresh conversation.

- **Branches:** code + `CLAUDE.md` on `Lirone's-Branch`; the docs suite lives ONLY on `main`
  (reduced to a docs-only landing branch), edited in a separate worktree.
- **Method:** read-only audit first (grep every controller route, list every `sql/` file,
  read all 7 docs in full, verify auth/config/nav against code) → drift report → fix on
  approval.
- **Constraint honored:** docs-only edits (no app code changed to match a doc); nothing
  committed or pushed; nothing near secrets touched.
- **Status: all fixes applied.** CLAUDE.md edited in place (committed-ready on
  `Lirone's-Branch`); the 7 docs edited in an **uncommitted** `main` worktree at
  `c:\Dev\TrainWise-docs-main` awaiting the user's commit + push.

---

## 0. Why this was done

CLAUDE.md mandates the docs suite stay in lockstep with the code, but several fast sessions
(the 14-feature "green batch", a JWT/auth security pass on 2026-07-02, a Local-LAN mode
rotation, yesterday's load-math correctness pass) had left drift. The audit was exhaustive by
design — catch EVERY miss, don't sample.

**Headline finding:** the docs on `main` were in **far better shape than expected** — recent
sync commits already documented JWT auth, the green batch, all 15 migrations, and the
22-controller API surface. The real drift concentrated in four themes:
1. **CLAUDE.md itself was the worst offender** (14 items, stale since before the security pass).
2. **"current backend mode" claims were wrong everywhere** (docs said Azure; code says
   `BACKEND_MODE = 'local'`).
3. **README/SETUP/DEPLOY still told the old "edit BASE_URL in two files" story** — superseded
   by the central switch `src/config/backend.js`.
4. **The tab bar changed** (Home / Load / Health / Connect — no Profile tab) and no doc knew.

---

## 1. Ground-truth gathered (what the code actually is, 2026-07-07)

### Backend: 23 controllers (22 "feature" + BaseApiController)
`api/[controller]` unless noted. Full route list verified by grepping every
`[Route]`/`[HttpGet/Post/Put/Delete]`:

- **AuthController** `api/auth` — `POST /login` (`[AllowAnonymous]`, rate-limited, returns
  `{token, user}`).
- **UsersController** `api/users` — `GET /` (**403 Forbid**, locked down), `GET /{id}`,
  `POST /` (`[AllowAnonymous]`, reCAPTCHA, returns `{userID, token}`), `PUT /{id}`,
  `DELETE /{id}`, `POST /{id}/upload`, `PUT /{id}/equip`, `GET /cosmetics`,
  `PUT /{id}/pushtoken`, `GET /{id}/summary`, `PUT /{id}/baseline`,
  `GET/POST /{id}/measurements`, `PUT /{id}/password`, `POST /google-login`
  (`[AllowAnonymous]`).
- **UserGoalsController** `api/users/{userId}/goals` — `POST /{goalId}`, `DELETE /{goalId}`.
- **UserDevicesController** `api/users/{userId}/devices` — `GET /`, `POST /`, `PUT /{deviceId}`.
- **UserActivityPreferencesController** `api/users/{userId}/activity-preferences` —
  `POST /{activityTypeId}`, `DELETE /{activityTypeId}`.
- **ActivityLogController** `api/activitylog` — `GET /user/{userId}`, `POST /`, `PUT /`,
  `GET /{id}/notes`, `PUT /{id}/notes`, `DELETE /{id}`.
- **ActivityTypeController** `api/activitytype` — `GET /`.
- **DailyLoadController** `api/dailyload` — `GET /user/{userId}/analytics`
  (`?days=&end=&tzOffsetMinutes=`), `GET /user/{userId}`, `POST /user/{userId}/calculate`
  (body `{date, tzOffsetMinutes}`).
- **LoadParametersController** `api/loadparameters` — `GET /`.
- **InjuryReportController** `api/injuryreport` — `GET /user/{userId}`,
  `GET /user/{userId}/active`, `PUT /{injuryId}/recover`, `GET /{injuryId}/pain`,
  `POST /{injuryId}/pain`, `POST /`.
- **InjuryTypesController** `api/injurytypes` — `GET /`.
- **TrainingGoalsController** `api/traininggoals` — `GET /`.
- **RecommendationController** `api/recommendation` — `GET /user/{userId}`, `POST /`.
- **CoachController** `api/coach` — `GET /by-user/{userId}`, `GET /{coachId}/trainees`,
  `GET /{coachId}/trainees/{userId}/load`, `GET /for-trainee/{userId}`.
- **CoachTraineeController** `api/coachtrainee` — `POST /{coachId}/connect/{userId}`,
  `DELETE /{coachId}/disconnect/{userId}`.
- **CoachRecommendationsController** `api/coachrecommendations` — `POST /`, `GET /user/{userId}`.
- **MessagesController** `api/messages` — `POST /`, `POST /upload`,
  `GET /conversation/{userA}/{userB}`, `PUT /seen/{senderId}/{receiverId}`,
  `GET /unread/{userId}`, `PUT/GET /typing/{fromUserId}/{toUserId}`,
  `POST /{messageId}/react/{userId}`, `GET /reactions/{userA}/{userB}`.
- **SocialController** `api/social` — presence/location (`PUT /presence/{userId}`,
  `PUT /location/{userId}`, `PUT /sharelocation/{userId}`, `GET /nearby/{userId}`,
  `GET /profile/{viewerId}/{targetId}`); friends (`POST /friends/request/{r}/{a}`,
  `PUT /friends/respond/{friendshipId}/{accept}`, `GET /friends/{userId}`,
  `GET /friends/requests/{userId}`, `DELETE /friends/{userA}/{userB}`); coach offers
  (`POST /coachoffer/{coachUserId}/{traineeUserId}`,
  `PUT /coachoffer/respond/{offerId}/{accept}`, `GET /coachoffer/trainee/{traineeUserId}`,
  `GET /coachoffer/sent/{coachUserId}`).
- **GymsController** `api/gyms` — `GET /`, `GET /{gymId}/coaches`,
  `POST /{gymId}/coaches/{coachUserId}`, `DELETE /{gymId}/coaches/{coachUserId}`,
  `GET /for-coach/{coachUserId}`.
- **RecordsController** `api/records` — `GET /{userId}`, `POST /check/{userId}`.
- **WorkoutBoardController** `api/board` — `GET /`, `POST /`, `DELETE /{postId}`,
  `POST /{postId}/like/{userId}`,
  `GET /leaderboard?country=&metric=&limit=&scope=global|friends&viewerId=`,
  `POST /kudos/{logId}/{userId}`, `GET /kudos/{logId}?viewerId=`,
  `PUT /leaderboard/optin/{userId}?on=`.
- **CalendarController** `api/calendar` — `GET /{userId}`, `POST /{userId}`, `PUT /{planId}`,
  `DELETE /{planId}`, `PUT /{planId}/complete`.

### Auth (JWT, since the 2026-07-02 security pass)
- `BL/JwtService.cs` — HS256, env config `JWT_KEY`/`JWT_ISSUER`/`JWT_AUDIENCE`/
  `JWT_EXPIRY_DAYS` (default 30) + `AUTH_ENFORCE` (default off). Random per-process key if
  `JWT_KEY` unset (dev). Claims: `uid`, `isCoach`, `isTrainee`, sub/jti/email/name.
- `Program.cs` — JwtBearer validation; `AUTH_ENFORCE=true` adds a fallback policy requiring a
  token on every non-`[AllowAnonymous]` endpoint. Rate limiter: "auth" policy 10/min/IP +
  global 300/min/IP. Global exception handler → generic 500. **Swagger gated to
  `IsDevelopment()`** (NOT on in prod). CORS `AllowAnyOrigin/Header/Method`.
- `BaseApiController.cs` — `CallerId`/`CallerIsCoach` from claims; gates `CallerMayAct`,
  `CallerMayActEither`, `CallerOwnsOrCoaches`, `CallerOwnsCoachId` (all allow tokenless,
  deny wrong-user).
- `PasswordHasher.cs` — PBKDF2 SHA-256, 100k iterations, 128-bit salt, verify-and-upgrade.
- Frontend token: `src/api/authToken.js` (memory + AsyncStorage key `@trainwise_token`),
  bearer interceptors on both axios clients + raw-fetch uploads + mlApi.js.

### Config: central backend switch (NEW)
`src/config/backend.js` — `BACKEND_MODE = 'local'` (currently), `LOCAL_PC_IP = '192.168.1.118'`,
exports `API_BASE_URL` (both axios clients import it) + `LOCAL_ML_URL`. **`mlApi.js` still
hardcodes its own `ML_BASE_URL` separately** (does not import `LOCAL_ML_URL` yet).
Live Azure URL: `https://trainwise01-api-djcfcvcedth8hjgp.israelcentral-01.azurewebsites.net/api`.

### Navigation: tabs are Home / Load / Health / Connect (NO Profile tab)
- `LoadTab` = `WarningsDashboardScreen` mounted directly (labeled "Load", B-1 redesign).
- Load + Health hidden when `isCoach && !isTrainee` (coach-only sees Home + Connect).
- Profile is a HomeStack screen. HomeStack also has `CoachTraineeAnalytics`,
  `PersonalRecords`, `TrainingCalendar`, `Timer`, `Achievements`. ConnectStack has
  `WorkoutBoard`, `Leaderboard`.

### Migrations: 15 dated scripts in `sql/`
`2026-06-02_add_is_trainee` · `2026-06-04_add_messages` · `2026-06-07_add_message_image` ·
`2026-06-08_add_social` · `2026-06-12_add_forecasts` · `2026-06-18_add_injury_link` ·
`2026-06-19_add_calendar` · `_add_cosmetics` · `_add_live_location` · `_add_records` ·
`_add_workout_board` · `2026-06-21_add_board_image` · `2026-06-21_add_push_token` ·
`2026-06-28_add_green_batch` (notes/photos, InjuryPainLog, BodyMeasurements, MessageTyping,
MessageReactions, WorkoutKudos) · `2026-07-02_security_hardening` (widens `Users.Password` to
`NVARCHAR(200)` for the PBKDF2 hash — must run BEFORE the hashing backend deploys).

### Other verified facts
- `UsersController` upload saves `{id}_{Guid:N}{ext}` (not `{ticks}`) + `UploadValidator`.
- `CoachBL.GetCoachByUserId` **lazy-creates** the Coaches row (coach-row 404 is fixed).
- Gender PNGs `000-003.png` **exist** in `assets/images/`.
- `PublishProfiles/` has `TrainWise-api` and `TrainWise01-api` Web Deploy profiles.
- The C# API has **no** `/health` endpoint — `/health` belongs to the Python ML service.
- `LeaderboardScreen` has a Global/Friends scope toggle (#170) wired to the `scope` param.

---

## 2. The drift report (what was wrong, by doc)

### CLAUDE.md — 14 items (the worst offender)
| # | Was | Now |
|---|---|---|
| C1 | "Session-based, no JWT" | Full JWT writeup (JwtService, AUTH_ENFORCE, BaseApiController gates, authToken.js, Google/reCAPTCHA/rate-limit/PBKDF2) |
| C2 | "back in Azure mode… both BASE_URLs point at azure" | `BACKEND_MODE` switch, current `'local'` / .118 |
| C3 | Mode A/B edit BASE_URL in both files; restore = dead `fuaahua` URL | one-line `BACKEND_MODE` flip; live `trainwise01-…` URL |
| C4 | "Swagger enabled in production" | gated to Development |
| C5 | tabs Home/Health/Connect/Profile; ProfileStack | Home/Load/Health/Connect; Profile in HomeStack; new screens listed |
| C6 | gender PNGs missing; route maps "next planned"; notif-icon caveat | PNGs exist; route maps shipped 2026-06-03; only HC-calories + notif-icon caveats remain |
| C7 | "Coach row caveat (open issue)" | RESOLVED — CoachBL lazy-create |
| C8 | upload `{id}_{ticks}.{ext}` | `{id}_{guid}.{ext}` + UploadValidator |
| C9 | Messages = 5 endpoints | + typing + reactions |
| C10 | run-order stops at forecasts | all 15 migrations |
| C11 | links `TrainWise/sql/…` | root `sql/…` (broken links fixed) |
| C12 | no Google Sign-In / reCAPTCHA / FCM | all added (SignUp flow + Push section) |
| C13 | "IP .119 baked in"; ".119→.117" | `LOCAL_PC_IP` in backend.js |
| C14 | module layout omits `src/config/` | added |

### README.md — 4 items
- R1 "Azure mode (current)" → describe the switch, not a hardcoded mode.
- R2 config table "edit both api.js + services/api.js" → `src/config/backend.js`.
- R3 "13 dated migration scripts" (×2) → 15.
- R4 "30 screens" → 31 files (30 user-facing + HomeRouter).

### docs/SETUP.md — 6 items
- S1 modes table "Azure (current)" + "they do by default" → local is current; one-line switch.
- S2/S3 "same BASE_URL in both files" (Step 5 + config table + troubleshooting) → backend.js.
- S4 "the two axios clients drifted" → impossible now; only backend.js-vs-mlApi.js split remains.
- S5 cheat sheet tabs "…/ Profile" → "…/ Load".
- S6 "(30)" screens → 31 files + added `config/backend.js` to the tree.
- (Migration run-order list in SETUP.md was already complete + correct — verified.)

### docs/DEPLOY.md — 2 items
- D1 "same BASE_URL in both" (Part 2 + diagram note) → `BACKEND_MODE`.
- D2 "Switching modes" steps "set both BASE_URLs" → `BACKEND_MODE`.
- (Publish profiles, Azure env vars, Swagger-gate, keystore story were all correct.)

### docs/features.md — 5 items
- F1 `/analytics` + `/calculate` → added `tzOffsetMinutes`.
- F2 ML endpoints → added `?tzOffsetMinutes=`.
- F3 `/board/leaderboard` bare → full signature incl. the undocumented **friends scope** (#170).
- F4 §9 nav "…/ Profile" → "…/ Load" (Profile = HomeStack screen).
- F5 §1 + §8 → added the 2026-07-06 load-math rules + the `TrainWise.Tests` xUnit project.

### docs/featureslist.md — 2 items
- L1 #64 "Weekly leaderboard (opt-in)" → added Global/Friends scope toggle.
- L2 numbering out of order (…100 → 110-125 → 101-109) → renumbered 101-125 in sequence.

### docs/PROJECT_SCOPE_FLOWCHART.md — 3 items
- P1 §3 load flow `chronic = /4`, plain thresholds, `{date}` → confirmed-only, dynamic floor +
  covered-days ramp, injured bands (Red ≥ 1.2), `tzOffsetMinutes`.
- P2 §4 "point both BASE_URLs" → `BACKEND_MODE`.
- P3 §1 tabs "Home · Health · Connect · Profile" → "Home · Load · Health · Connect".

### docs/SECURITY.md — 1 micro-fix
- `[AllowAnonymous]` "…/ health" → clarify `/health` is the ML service's, not the C# API's.
  (Everything else verified line-by-line against code — clean.)

---

## 3. What was changed (where the edits live)

### CLAUDE.md (on `Lirone's-Branch`, edited in place)
~69 insertions / 54 deletions. All C1-C14 applied. Broken `TrainWise/sql/` links fixed via a
`sed` pass. The Auth-model section is now a full JWT writeup; the backend-mode sections point
at `backend.js` as the source of truth (the dead `fuaahua` URL kept only as labeled history).

### The 7 docs (on `main`, in an UNCOMMITTED worktree)
Created with `git worktree add ../TrainWise-docs-main main` (after `git branch -f main
origin/main` to fast-forward). Location: **`c:\Dev\TrainWise-docs-main`**. Diff stat:
```
README.md                       | 22 +++---
docs/DEPLOY.md                  | 21 +++---
docs/PROJECT_SCOPE_FLOWCHART.md | 15 ++--
docs/SECURITY.md                |  2 +-
docs/SETUP.md                   | 45 ++++----
docs/features.md                | 29 ++++--
docs/featureslist.md            | 52 +++++-----
7 files changed, 110 insertions(+), 76 deletions(-)
```

---

## 4. Verification performed

Re-grepped every stale pattern across both locations after fixing — clean:
`Session-based` · `both BASE_URLs` / `both files` · `192.168.1.117` / `.119` ·
`Azure mode (current)` · `13 dated` / `13 migrations` · `30 screens` / `(30)` ·
`Home / Health / Connect / Profile` · `Swagger enabled in production` · `{ticks}` ·
`open issue` · broken `TrainWise/sql/` links. (The only surviving "both files" hit in
CLAUDE.md is the corrected sentence explaining both import from backend.js — intended.)

---

## 5. What remains for the user to do

**Publish the docs** (the code + CLAUDE.md edits are already on `Lirone's-Branch`; the 7 docs
are uncommitted on `main` in the worktree):

1. `cd c:\Dev\TrainWise-docs-main`
2. `git diff` to review.
3. Commit — e.g. `git commit -am "docs: sync backend-mode switch, tab bar, load-math params,
   migration count, leaderboard scope"`. **Commit is required BEFORE push** — clicking Push in
   VS Code without committing does nothing (the edits are uncommitted).
4. `git push` to `main`.
5. Afterwards: `git worktree remove ../TrainWise-docs-main` (only AFTER committing — the edits
   live only there).

Docs-only, no secrets near these files (verified) — the safe-push `appsettings.json` dance
does not apply here (that's a code-branch concern).

---

## 6. Honest caveats

- CLAUDE.md now states the current mode/IP as of 2026-07-07 (`'local'` / .118). Those two
  facts drift on every mode-flip or DHCP renewal; everything else was rewritten to point at
  `backend.js` as the source of truth so it stays drift-proof.
- `app.json` still points the notification icon at the colored `wowowow.png` (line ~52).
  Refinements R2 supposedly shipped a silhouette; could NOT confirm on device, so it stays a
  flagged pending item, not marked resolved.
- `mlApi.js` not yet importing `LOCAL_ML_URL` from backend.js is real (half-built) — documented
  as such, not hidden.
