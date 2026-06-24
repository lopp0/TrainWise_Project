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
  `Controllers → BL → DAL → DBservice`. On Azure App Service + Azure SQL.
- **Frontend** — React Native 0.81 / Expo SDK 54 (Android), session‑based auth, two axios clients.
- **ML** — a separate Python / Flask service for coach analytics (local).

---

## 2. Core feature map

| Area | Frontend | Backend |
|---|---|---|
| Auth | `LoginScreen`, `SignUpScreen`, `SignUpFinal`, `AuthContext` | `AuthController`, `UsersController` |
| Load dashboard | `HomeScreen`, `StatsScreen`, `WarningsDashboardScreen` | `ActivityLogController`, `DailyLoadController`, `LoadParametersController` |
| Workouts | `AddWorkoutScreen`, `WorkoutSummaryScreen`, `WorkoutRouteScreen` | `ActivityLogController`, `ActivityTypeController` |
| Injuries | `InjuryReportScreen`, `ActiveInjuriesScreen` | `InjuryReportController`, `InjuryTypesController` |
| Health Connect | `GoogleFitScreen`, `SyncService`, `HealthConnectService` | `ActivityLogController`, `UserDevicesController` |
| Coach | `CoachDashboardScreen`, `CoachTraineeDetailScreen`, `CoachTraineeAnalyticsScreen`, `ConnectQRScreen` | `CoachController`, `CoachTraineeController`, `CoachRecommendationsController` |
| Chat | `ChatScreen`, `MyCoachScreen`, `MessagesContext` | `MessagesController` |
| Social | `ConnectScreen`, `RequestsScreen`, `SocialContext` | `SocialController`, `GymsController` |
| Gamification | `PersonalRecordsScreen`, `WorkoutBoardScreen`, `LeaderboardScreen`, `TrainingCalendarScreen`, `ShopScreen` | `RecordsController`, `WorkoutBoardController`, `CalendarController`, `UsersController` (cosmetics) |
| Smart suggestion | `SmartSuggestionCard`, `utils/smartWorkout.js`, `api/weatherService.js` | — (client‑side; external weather APIs) |
| AI chat | `AIChatScreen`, `api/openai.js` | — (client → OpenAI) |
| Coach forecast | `CoachTraineeAnalyticsScreen`, `services/mlApi.js` | Python `ml/` service |

---

## 3. Complete API surface (22 controllers)

All controllers route at `api/[controller]` unless noted. POST/PUT bodies are JSON (`[FromBody]`), so
clients must send `Content-Type: application/json` even for "empty" bodies.

### Auth & Users
**`AuthController`** — `api/auth`
- `POST /login` — email + password → user (via `sp_LoginUser`)

**`UsersController`** — `api/users`
- `GET /` · `GET /{id}` · `POST /` (register) · `PUT /{id}` · `DELETE /{id}`
- `POST /{id}/upload` — profile image (multipart)
- `GET /{id}/summary` · `PUT /{id}/baseline`
- `GET /cosmetics` · `PUT /{id}/equip` — cosmetics shop
- `PUT /{id}/pushtoken` — FCM token
- `POST /google-login` — Google sign‑in

**`UserGoalsController`** — `api/users/{userId}/goals` — `POST /{goalId}` · `DELETE /{goalId}`
**`UserDevicesController`** — `api/users/{userId}/devices` — `GET /` · `POST /` · `PUT /{deviceId}`
**`UserActivityPreferencesController`** — `api/users/{userId}/activity-preferences` — `POST /{activityTypeId}` · `DELETE /{activityTypeId}`

### Workouts & Load
**`ActivityLogController`** — `api/activitylog` — `GET /user/{userId}` · `POST /` · `PUT /` · `DELETE /{id}`
**`ActivityTypeController`** — `api/activitytype` — `GET /` (20 seeded types)
**`DailyLoadController`** — `api/dailyload` — `GET /user/{userId}` · `POST /user/{userId}/calculate` (body: `{ "date": "<ISO>" }`)
**`LoadParametersController`** — `api/loadparameters` — `GET /` (tuning row)

### Injuries
**`InjuryReportController`** — `api/injuryreport` — `GET /user/{userId}` · `GET /user/{userId}/active` · `POST /` · `PUT /{injuryId}/recover`
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
- `POST /` · `POST /upload` (image) · `GET /conversation/{userA}/{userB}` · `PUT /seen/{senderId}/{receiverId}` · `GET /unread/{userId}`

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

**`CalendarController`** — `api/calendar`
- `GET /{userId}` · `POST /{userId}` · `PUT /{planId}` · `DELETE /{planId}` · `PUT /{planId}/complete`

---

## 4. ML service API (Python / Flask, local)

`ml/app.py` binds `0.0.0.0:8000`, reads the same SQL DB via `pyodbc` (Windows Integrated Security), and
mirrors the C# load formula exactly.

- `GET /health`
- `GET /api/ml/trainee/<id>/pmc` — Fitness / Fatigue / Form series
- `GET /api/ml/trainee/<id>/acwr` — ACWR series with safe‑zone band
- `GET /api/ml/trainee/<id>/forecast[?month=YYYY-MM]` — monthly regression forecast (appends a snapshot to `MonthlyForecasts`)
- `GET /api/ml/trainee/<id>/forecast/history` — past monthly snapshots

---

## 5. Background & client‑side services

There are **no** server‑side background/hosted services — the C# API is request/response only. The
"always‑running" behavior lives in the **client** as polling/heartbeat contexts:

| Service | File | What it does |
|---|---|---|
| Health sync | `src/api/SyncService.js`, `HealthSyncContext.js`, `useSyncWorkouts.js` | HC permission → fetch sessions → dedupe (+ tombstones) → POST new logs; throttled, focus‑driven |
| Messages poll | `src/api/MessagesContext.js` | 12s global unread poll → local notification when total rises |
| Social presence | `src/api/SocialContext.js` | 60s presence heartbeat (`PUT /social/presence/{id}`) + 25s inbox poll → pushes on new requests/friends/offers |
| Notifications | `src/api/NotificationService.js` | schedules the 18:00 load‑aware reminder; fires workout‑warning pushes |

---

## 6. External & third‑party integrations

| Integration | Used for | Notes |
|---|---|---|
| Azure App Service | Hosts the C# API | Israel Central |
| Azure SQL Database | Primary datastore | `TrainWiseDB`; connection injected via the App Service blade |
| Google Maps SDK | Map rendering + cardio routes | native key injected via `app.config.js` |
| Google Weather API | Smart‑suggestion weather factors | **separate SKU** from Maps |
| Google Air Quality API | Smart‑suggestion AQI factor | **third separate SKU** |
| OpenAI | In‑app AI chat + injury advice | called directly from the device (`api/openai.js`) |
| Firebase Cloud Messaging | Push notifications | `google-services.json` (gitignored) |
| Google Health Connect | Workout import (Android) | read‑only; six health permissions |
| Google Sign‑In / OAuth | Social login | `POST /api/users/google-login` |

---

## 7. Cross‑cutting backend capabilities

- **Three‑layer separation** — controllers are thin REST surfaces; `BL/` holds logic
  (`LoadCalculationBL.cs` is the core algorithm: acute load, AC ratio, stress score, warning level);
  `DAL/` is manual ADO.NET; `DBservice.cs` is the shared connection helper.
- **No DTO layer** — `Models/` POCOs are shared across layers; request shapes are `Create*Request` /
  `Update*Request` classes.
- **Error contract** — controllers return `BadRequest(ex.Message)`; the real error is in the **response
  body**, not just the status code.
- **Config** — `DBservice.Connect()` reads config with environment‑variable fallback so Azure's
  injected connection string wins over `appsettings.json`.
- **Swagger** — mounted in Development only (`Program.cs`).
- **CORS** — currently `AllowAnyOrigin / AllowAnyHeader / AllowAnyMethod` (a hardening item).

---

## 8. Frontend capabilities

- **Navigation** — a single root `NavigationStack` with a tab navigator (Home / Health / Connect /
  Profile) and per‑tab sub‑stacks; no Expo Router.
- **Two axios clients** — `services/api.js` (canonical) and `api/api.js` (legacy, being phased out);
  both must share the same `BASE_URL`. `services/mlApi.js` is the ML client.
- **Theming** — a mutable `Colors` singleton swapped by `applyTheme`; every screen uses the
  `useThemedStyles(makeStyles)` hook so light/dark switches actually take effect.
- **Shared chart logic** — `getBarColor(load)` and per‑day session‑load aggregation are shared between
  Home and Warnings to keep colors/values consistent.
- **Time handling** — the backend stores zone‑less UTC; the client appends `Z` (`utils/serverDate.js`)
  and renders in `Asia/Jerusalem`.
- **Native** — Health Connect (with hand‑maintained manifest aliases), `expo-maps`, `expo-camera`,
  `expo-notifications`, `expo-image-picker`.

---

## 9. Data layer

- **Engine** — SQL Server (Azure SQL prod / SQL Express local). Schema name `TrainWiseDB` on Azure,
  `TrainWise` locally.
- **Access** — 100% stored procedures via ADO.NET; no ORM, no migrations framework.
- **Schema source** — `sql/TWDB.sql` / `sql/TrainWiseV2.sql` (schema + procs, no data) plus 13 dated
  migration scripts that must be run in order against both DBs.
- **Seed data** — `sql/seed_reference_data.sql` (idempotent): 20 activity types (with intensity
  factors), 20 injury types + categories, 20 training goals, and the `LoadParameters` tuning row.
- **Runtime tables** — `Users`, `Coaches`, `ActivityLogs`, `DailyLoad`, `Messages`, `Friendships`,
  `Gyms`, `CoachOffers`, `MonthlyForecasts`, board/records/calendar/cosmetics tables.

---

## 10. Known gaps

- No CI/CD, no automated secret scanning, no static analysis (see [SECURITY.md](SECURITY.md) +
  [roadmap](../README.md#roadmap--planned)).
- Auth is session‑based with no salted password hash and no rate limiting.
- The ML service is local‑only — the coach forecast doesn't work without the dev PC running.
- Two axios clients can drift; an IP/host mismatch silently breaks a subset of screens.
- AI chat history is in‑memory; profile images on Azure may not survive App Service restarts.
