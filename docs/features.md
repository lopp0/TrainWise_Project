# TrainWise — Technical Feature Inventory

> The engineering‑level companion to [`featureslist.md`](featureslist.md): the API surface, services,
> integrations, and data layer. For the polished, grouped product list see `featureslist.md`; for the
> deepest architecture notes and gotchas see [`../CLAUDE.md`](../CLAUDE.md).

---

## 1. What TrainWise is

A training‑load / injury‑prevention app for athletes and coaches. An athlete logs workouts (manually or
from Google Health Connect); the backend turns sessions into acute / chronic load and an **ACWR** with a
color‑coded warning level. Around that core sit a coach dashboard, chat, a social layer, gamification,
weather‑aware suggestions, and an ML forecast.

- **Backend** — ASP.NET Core 8, raw ADO.NET (no EF), SQL Server stored procedures, three‑layer
  `Controllers → BL → DAL → DBservice`. **JWT bearer auth** with per‑object ownership checks. On Azure
  App Service + Azure SQL.
- **Frontend** — React Native 0.81 / Expo SDK 54 (Android), token‑based auth (bearer interceptor on both
  axios clients), two axios clients.
- **ML** — a separate Python / Flask service for coach analytics (local), with optional shared‑JWT auth.

---

## 2. Core feature map

| Area | Frontend | Backend |
|---|---|---|
| Auth | `LoginScreen`, `SignUpScreen`, `SignUpFinal`, `AuthContext`, `api/authToken.js` | `AuthController`, `UsersController`, `BL/JwtService`, `BaseApiController` |
| Load dashboard | `HomeScreen`, `StatsScreen`, `WarningsDashboardScreen` | `ActivityLogController`, `DailyLoadController`, `LoadParametersController` |
| Load analytics | `CoachTraineeAnalyticsScreen`, `components/LoadAnalyticsSection`, `AcwrTrendChart`, `utils/loadSeries` | `DailyLoadController` (`/analytics`), `BL/LoadAnalyticsBL` |
| Workouts | `AddWorkoutScreen`, `WorkoutSummaryScreen`, `WorkoutRouteScreen`, `TimerScreen` | `ActivityLogController`, `ActivityTypeController` |
| Injuries + pain | `InjuryReportScreen`, `ActiveInjuriesScreen`, `components/PainTracker` | `InjuryReportController` (`/pain`), `InjuryTypesController` |
| Body metrics | `components/WeightTracker` | `UsersController` (`/measurements`), `Models/BodyMeasurement` |
| Health Connect | `GoogleFitScreen`, `SyncService`, `HealthConnectService` | `ActivityLogController`, `UserDevicesController` |
| Coach | `CoachDashboardScreen`, `CoachTraineeDetailScreen`, `CoachTraineeAnalyticsScreen`, `ConnectQRScreen` | `CoachController`, `CoachTraineeController`, `CoachRecommendationsController` |
| Chat | `ChatScreen`, `MyCoachScreen`, `MessagesContext` | `MessagesController` (typing + reactions) |
| Social | `ConnectScreen`, `RequestsScreen`, `SocialContext` | `SocialController`, `GymsController` |
| Gamification | `PersonalRecordsScreen`, `WorkoutBoardScreen`, `LeaderboardScreen`, `TrainingCalendarScreen`, `ShopScreen`, `AchievementsScreen` | `RecordsController`, `WorkoutBoardController` (kudos), `CalendarController`, `UsersController` (cosmetics) |
| Smart suggestion | `SmartSuggestionCard`, `utils/smartWorkout.js`, `api/weatherService.js` | — (client‑side; external weather APIs) |
| AI chat | `AIChatScreen`, `api/openai.js` | — (client → OpenAI) |
| Coach forecast | `CoachTraineeAnalyticsScreen`, `services/mlApi.js` | Python `ml/` service |

---

## 3. Auth & security model

- **JWT bearer** (`BL/JwtService.cs`, HS256, key from the `JWT_KEY` env var). Login / signup /
  google‑login return `{ token, user }`; both axios clients + the raw‑`fetch` uploads + `mlApi.js` attach
  `Authorization: Bearer` (`src/api/authToken.js`).
- **`AUTH_ENFORCE` rollout** — the server validates tokens when present and (once `AUTH_ENFORCE=true` in
  Azure) requires them. `[AllowAnonymous]` only on login / signup / google‑login / health.
- **Per‑object ownership** (`Controllers/BaseApiController.cs`: `CallerMayAct`, `CallerOwnsOrCoaches`,
  `CallerOwnsCoachId`, owner‑lookup helpers in the DAL) gate self‑scoped and resource‑id‑keyed endpoints
  so a token can't act on another user's data.
- **PBKDF2** password hashing (`BL/PasswordHasher.cs`) + verify‑and‑upgrade; **rate limiting** (auth
  policy + global backstop); **upload validation** (`BL/UploadValidator.cs`, magic bytes + GUID names);
  server‑side **Google ID‑token** + **reCAPTCHA** verification. Full detail:
  [`SECURITY.md`](SECURITY.md) and [`../tasks/security_audit_2026_07_02.md`](../tasks/security_audit_2026_07_02.md).

---

## 4. Complete API surface (22 controllers)

All controllers route at `api/[controller]` unless noted. POST/PUT bodies are JSON (`[FromBody]`), so
clients must send `Content-Type: application/json` even for "empty" bodies. Non‑anonymous endpoints are
subject to the JWT ownership gate above.

### Auth & Users
**`AuthController`** — `api/auth`
- `POST /login` — email + password → `{ token, user }` (PBKDF2 verify; rate‑limited; `[AllowAnonymous]`)

**`UsersController`** — `api/users`
- `GET /` — **403** (locked down; no admin role) · `GET /{id}` · `POST /` (register + **reCAPTCHA**
  verify → `{ userID, token }`; rate‑limited) · `PUT /{id}` · `DELETE /{id}`
- `POST /{id}/upload` — profile image (multipart, validated, GUID filename)
- `PUT /{id}/password` — change password (rate‑limited) · `GET /{id}/summary` · `PUT /{id}/baseline`
- `GET /{id}/measurements` · `POST /{id}/measurements` — body metrics (weight, etc.)
- `GET /cosmetics` · `PUT /{id}/equip` — cosmetics shop · `PUT /{id}/pushtoken` — FCM token
- `POST /google-login` — Google sign‑in; the backend **verifies the Google ID token server‑side**
  (`GoogleTokenVerifier`, audience‑checked) → `{ token, user }`. A client‑supplied `GoogleId` is not trusted.

**`UserGoalsController`** — `api/users/{userId}/goals` — `POST /{goalId}` · `DELETE /{goalId}`
**`UserDevicesController`** — `api/users/{userId}/devices` — `GET /` · `POST /` · `PUT /{deviceId}`
**`UserActivityPreferencesController`** — `api/users/{userId}/activity-preferences` — `POST /{activityTypeId}` · `DELETE /{activityTypeId}`

### Workouts & Load
**`ActivityLogController`** — `api/activitylog` — `GET /user/{userId}` · `POST /` · `PUT /` · `DELETE /{id}` · `GET /{id}/notes` · `PUT /{id}/notes`
**`ActivityTypeController`** — `api/activitytype` — `GET /` (20 seeded types)
**`DailyLoadController`** — `api/dailyload` — `GET /user/{userId}` · `GET /user/{userId}/analytics` (rolling load analytics) · `POST /user/{userId}/calculate` (body: `{ "date": "<ISO>" }`)
**`LoadParametersController`** — `api/loadparameters` — `GET /` (tuning row)

### Injuries
**`InjuryReportController`** — `api/injuryreport` — `GET /user/{userId}` · `GET /user/{userId}/active` · `POST /` · `PUT /{injuryId}/recover` · `GET /{injuryId}/pain` · `POST /{injuryId}/pain` (pain logs)
**`InjuryTypesController`** — `api/injurytypes` — `GET /`
**`TrainingGoalsController`** — `api/traininggoals` — `GET /`
**`RecommendationController`** — `api/recommendation` — `GET /user/{userId}` · `POST /`

### Coach
**`CoachController`** — `api/coach`
- `GET /by-user/{userId}` · `GET /{coachId}/trainees` · `GET /{coachId}/trainees/{userId}/load` · `GET /for-trainee/{userId}`

**`CoachTraineeController`** — `api/coachtrainee` — `POST /{coachId}/connect/{userId}` · `DELETE /{coachId}/disconnect/{userId}`
**`CoachRecommendationsController`** — `api/coachrecommendations` — `POST /` · `GET /user/{userId}`

### Chat
**`MessagesController`** — `api/messages`
- `POST /` · `POST /upload` (image, validated) · `GET /conversation/{userA}/{userB}` · `PUT /seen/{senderId}/{receiverId}` · `GET /unread/{userId}`
- `PUT /typing/{fromUserId}/{toUserId}` · `GET /typing/{fromUserId}/{toUserId}` — typing indicator
- `POST /{messageId}/react/{userId}` · `GET /reactions/{userA}/{userB}` — message reactions

### Social
**`SocialController`** — `api/social`
- presence/location: `PUT /presence/{userId}` · `PUT /location/{userId}` · `PUT /sharelocation/{userId}` · `GET /nearby/{userId}` · `GET /profile/{viewerId}/{targetId}`
- friends: `POST /friends/request/{requesterId}/{addresseeId}` · `PUT /friends/respond/{friendshipId}/{accept}` · `GET /friends/{userId}` · `GET /friends/requests/{userId}` · `DELETE /friends/{userA}/{userB}`
- coach offers: `POST /coachoffer/{coachUserId}/{traineeUserId}` · `PUT /coachoffer/respond/{offerId}/{accept}` · `GET /coachoffer/trainee/{traineeUserId}` · `GET /coachoffer/sent/{coachUserId}`

**`GymsController`** — `api/gyms`
- `GET /` · `GET /{gymId}/coaches` · `POST /{gymId}/coaches/{coachUserId}` · `DELETE /{gymId}/coaches/{coachUserId}` · `GET /for-coach/{coachUserId}`

### Gamification
**`RecordsController`** — `api/records` — `GET /{userId}` · `POST /check/{userId}`
**`WorkoutBoardController`** — `api/board`
- `GET /` · `POST /` · `DELETE /{postId}` · `POST /{postId}/like/{userId}` · `GET /leaderboard` · `PUT /leaderboard/optin/{userId}`
- `POST /kudos/{logId}/{userId}` · `GET /kudos/{logId}` — kudos on a workout

**`CalendarController`** — `api/calendar`
- `GET /{userId}` · `POST /{userId}` · `PUT /{planId}` · `DELETE /{planId}` · `PUT /{planId}/complete`

---

## 5. ML service API (Python / Flask, local)

`ml/app.py` binds `0.0.0.0:8000`, reads the same SQL DB via `pyodbc` (Windows Integrated Security), and
mirrors the C# load formula exactly. **Optional JWT auth** (`ml/auth.py`, gated by `ML_AUTH_ENFORCE`,
default off) validates the same token the C# API issues + a self‑or‑linked‑coach check.

- `GET /health` (always public)
- `GET /api/ml/trainee/<id>/pmc` — Fitness / Fatigue / Form series
- `GET /api/ml/trainee/<id>/acwr` — ACWR series with safe‑zone band (`?days=` clamped 1..400)
- `GET /api/ml/trainee/<id>/forecast[?month=YYYY-MM]` — monthly regression forecast (appends a snapshot to `MonthlyForecasts`)
- `GET /api/ml/trainee/<id>/forecast/history` — past monthly snapshots

---

## 6. Background & client‑side services

There are **no** server‑side background/hosted services — the C# API is request/response only. The
"always‑running" behavior lives in the **client** as polling/heartbeat contexts:

| Service | File | What it does |
|---|---|---|
| Health sync | `src/api/SyncService.js`, `HealthSyncContext.js`, `useSyncWorkouts.js` | HC permission → fetch sessions → dedupe (+ tombstones) → POST new logs; throttled, focus‑driven |
| Messages poll | `src/api/MessagesContext.js` | 12s global unread poll → local notification when total rises |
| Social presence | `src/api/SocialContext.js` | 60s presence heartbeat (`PUT /social/presence/{id}`) + 25s inbox poll → pushes on new requests/friends/offers |
| Notifications | `src/api/NotificationService.js` | schedules the 18:00 load‑aware reminder; fires workout‑warning pushes |

---

## 7. External & third‑party integrations

| Integration | Used for | Notes |
|---|---|---|
| Azure App Service | Hosts the C# API | Israel Central |
| Azure SQL Database | Primary datastore | `TrainWiseDB`; connection injected via the App Service blade (env var) |
| Google Maps SDK | Map rendering + cardio routes | native key injected via `app.config.js` |
| Google Weather API | Smart‑suggestion weather factors | **separate SKU** from Maps |
| Google Air Quality API | Smart‑suggestion AQI factor | **third separate SKU** |
| OpenAI | In‑app AI chat + injury advice | called directly from the device (`api/openai.js`) |
| Firebase Cloud Messaging | Push notifications | `google-services.json` (gitignored) |
| Google Health Connect | Workout import (Android) | read‑only; six health permissions |
| Google Sign‑In / OAuth | Social login | native picker → ID token verified server‑side |
| Google reCAPTCHA | Signup bot protection | site key in client, secret in Azure (`RECAPTCHA_SECRET`), fail‑open |

---

## 8. Cross‑cutting backend capabilities

- **Three‑layer separation** — controllers are thin REST surfaces (over `BaseApiController`); `BL/` holds
  logic (`LoadCalculationBL.cs` is the core algorithm: acute load, AC ratio, stress score, warning level);
  `DAL/` is manual ADO.NET; `DBservice.cs` is the shared connection helper.
- **Auth / authorization** — JWT bearer + per‑object ownership checks (see §3).
- **Rate limiting** — .NET 8 built‑in limiter: auth policy (10/min/IP) + global 300/min/IP backstop.
- **Error contract** — validation `ArgumentException` → `BadRequest(msg)`; unexpected exceptions →
  **generic 500** via a global handler (the real error is logged, not returned) — no internals leak.
- **Config** — `DBservice.Connect()` reads env vars first, so Azure's injected connection string (and
  `JWT_KEY`, `RECAPTCHA_SECRET`, …) win over `appsettings.json`; no secret in source.
- **Swagger** — mounted in Development only (`Program.cs`).
- **CORS** — currently `AllowAnyOrigin / AllowAnyHeader / AllowAnyMethod` (a hardening item, low impact
  with token auth).

---

## 9. Frontend capabilities

- **Navigation** — a single root `NavigationStack` with a tab navigator (Home / Health / Connect /
  Profile) and per‑tab sub‑stacks; no Expo Router.
- **Auth token** — `src/api/authToken.js` holds the JWT (in‑memory + AsyncStorage); a bearer interceptor
  is on both axios clients (`services/api.js`, `api/api.js`), the raw‑`fetch` uploads, and `mlApi.js`.
- **Central backend switch** — `src/config/backend.js` exposes `API_BASE_URL` + `LOCAL_ML_URL` so the two
  axios clients can't drift; flip `BACKEND_MODE` (`local` | `azure`) in one place.
- **Theming** — a mutable `Colors` singleton swapped by `applyTheme`; every screen uses
  `useThemedStyles(makeStyles)` so light/dark switches take effect. Includes a theme schedule.
- **Shared chart logic** — `getBarColor(load)` + per‑day aggregation shared between Home and Warnings;
  ACWR trend + load‑analytics charts via `react-native-svg`.
- **Time handling** — the backend stores zone‑less UTC; the client appends `Z` (`utils/serverDate.js`)
  and renders in `Asia/Jerusalem`.
- **Native** — Health Connect (hand‑maintained manifest aliases), `expo-maps`, `expo-camera`,
  `expo-notifications`, `expo-image-picker`, optional biometric lock (`utils/biometric.js`).

---

## 10. Data layer

- **Engine** — SQL Server (Azure SQL prod / SQL Express local). Schema name `TrainWiseDB` on Azure,
  `TrainWise` locally.
- **Access** — 100% parameterized stored procedures / `SqlParameter` via ADO.NET; no ORM, no migrations
  framework.
- **Schema source** — `sql/TWDB.sql` / `sql/TrainWiseV2.sql` (schema + procs, no data) plus **15+ dated
  migration scripts** (through `2026-07-02_security_hardening.sql`) run in order against both DBs.
- **Seed data** — `sql/seed_reference_data.sql` (idempotent): 20 activity types (with intensity factors),
  20 injury types + categories, 20 training goals, and the `LoadParameters` tuning row.
- **Runtime tables** — `Users` (password now `NVARCHAR(200)` for the PBKDF2 hash), `Coaches`,
  `ActivityLogs`, `DailyLoad`, `Messages` (+ reactions), `Friendships`, `Gyms`, `CoachOffers`,
  `MonthlyForecasts`, plus body‑measurement / pain‑log / board / records / calendar / cosmetics tables.

---

## 11. Known gaps

- The old Azure SQL password must be **rotated** (weak, was in the working `appsettings.json`); the OpenAI
  key is still bundled in the APK (`EXPO_PUBLIC_`) and should move server‑side.
- A few endpoints still need finer ownership rules; client token should move to `expo-secure-store`; add
  refresh tokens + HSTS + tighter CORS (see [SECURITY.md](SECURITY.md)).
- No CI/CD, automated secret scanning, or static analysis yet (see [roadmap](../README.md#roadmap--planned)).
- The ML service is local‑only — the coach forecast doesn't work without the dev PC running.
- AI chat history is in‑memory; profile images on Azure may not survive App Service restarts.
