# CLAUDE2.md  ·  File 2 of 3

<!-- CLAUDE-CHAIN ─────────────────────────────────────────────────────────────
  This file is part of a linked instruction set. Claude MUST read ALL files
  at the start of every session — each contains non-overlapping guidance.

  • CLAUDE.md  (file 1) → Documentation sync, repo layout, backend modes, architecture
  • CLAUDE2.md (YOU ARE HERE — file 2)
      Load analytics, ActivityLog invariants, theme, week start, AI chatbot,
      API keys, HC tombstones, user roles, coach/trainee chat, social layer
  • CLAUDE3.md (file 3) → Smart workout, injury scanner, profile pic, push notifications,
      Expo gotchas, ML service, GPS tracking, APK build, pending items, self-learning

  AUTO-EXPAND RULE (enforce at end of every session that edits this file):
  If this file exceeds 40 000 characters:
    1. Create CLAUDE4.md (or the next unused number).
    2. Move the bottom-most section(s) from THIS file into it until this file
       is under 38 000 chars.
    3. Update the CLAUDE-CHAIN header in EVERY existing CLAUDE*.md to list the
       new file with a one-line description.
    4. Copy this AUTO-EXPAND RULE block verbatim into the new file.
    5. Never lose content — every section must live in exactly one chain file.
──────────────────────────────────────────────────────────────────────────── -->

## Load analytics (rolling + EWMA trend, 2026-07-05; correctness pass 2026-07-06)

Day-by-day AC-ratio trend with TWO methods, shown on the trainee Load tab and inside a foldable "Load trend & analysis" card on CoachTraineeDetail:
- **DATA SOURCE — corrected 2026-07-19**: the trainee Load Trend (Classic rolling ACWR + Smooth EWMA) is **Python-primary**, the SAME architecture as the coach forecast — `components/LoadAnalyticsSection.js` calls `services/mlApi.getTraineeAnalytics` (`GET /api/ml/trainee/{id}/analytics`) FIRST, then falls back to the C# endpoint, then to the on-device mirror. (This doc previously said "C# is the source of truth"; that was the ORIGINAL 2026-07-05 design but the fetch order was later flipped to Python-first and the doc drifted.) So the trainee Load tab, like the coach analytics screen, **needs the local Python ML service running** for its live numbers and degrades to the C#/JS fallback when it's offline.
- **C# defines the canonical MATH**: `BL/LoadAnalyticsBL.cs` → `GET api/dailyload/user/{id}/analytics?days=56&end=YYYY-MM-DD&tzOffsetMinutes=180` (gate `CallerOwnsOrCoaches`; reuses `sp_GetActivityLogsForLoad` with a wide window via `DailyLoadDAL.GetActivityLogsForRange` — **no SQL migration**) — this is the FALLBACK data source, and its formula is the reference that `ml/features.py` (the primary source) and `utils/loadSeries.js` (last-resort mirror) must match exactly. Client must pass `end` = device-local date because Azure runs UTC (00:00-03:00 Israel drift), and `tzOffsetMinutes` = `-new Date().getTimezoneOffset()` so sessions bucket to the user's LOCAL calendar day (without it a 00:30 workout counts on the previous day).
- **Shared window math lives in `LoadCalculationBL` internal statics** (`BucketByLocalDay`, `SumRange`, `CountActiveDays`, `EffectiveChronic`, `DetermineLoadLevel`) — used by BOTH `CalculateAndSave` (stored DailyLoad) and `LoadAnalyticsBL`, and pinned by the `TrainWise.Tests` xUnit project (V1-V6 hand-computed vectors). ml/features.py and the JS mirrors must match these exactly.
- **2026-07-06 correctness rules** (apply to every load surface — C#, Python, JS):
  - **Unconfirmed HC imports never count** (`IsConfirmed = 0` skipped; NULL = confirmed). The SP has no filter — the C# side filters in `BucketByLocalDay`; the DAL maps `IsConfirmed` with NULL→true.
  - **Cold-start floor is DYNAMIC**: floor `chronic` at the experience bootstrap (150/280/420 weekly) whenever the trailing 28-day window has **< 7 days with load > 0** — NOT the one-shot `Users.IsBaselineEstablished` flag (which never resets; a returning-from-layoff athlete used to store a false Red while the app showed Green).
  - **Covered-days ramp** once ≥ 7 active days: `chronic = sum28 / min(4, covered/7)` where `covered` runs from the first loaded day inside the window. A steady 2-week-old user reads ~1.0 instead of a false Red 2.0; full 28-day histories are unchanged (/4). The EWMA needs no ramp — its bias correction already returns the sample mean over short history.
  - **Injured bands have no gap**: Red ≥ 1.2, Yellow 0.8 ≤ r < 1.2, Green < 0.8 (the old Yellow cap at 1.1 made an injured 1.15 read GREEN). Python `level_for`/`rule_class` and the Warnings screen now take the injured flag too.
  - **Grade levels from the UNROUNDED ratio** (1.3049 is Red; its displayed 1.30 would wrongly grade Yellow).
- Methods: classic rolling (Gabbett 2016, official — drives status/recommendations) and **bias-corrected EWMA** (Williams 2017 + the Adam zero-init correction, Kingma & Ba 2015; λ = 2/(N+1), t counts from first logged session). Correction is REQUIRED: without it a new user's first workout falsely reads Red on EWMA.
- Both use the same cold-start floor pre-baseline (rolling: weekly bootstrap 150/280/420; EWMA: bootstrap/7 because EWMA is daily-scale) and `LoadCalculationBL.DetermineLoadLevel` (now `internal static`).
- Summary block: Foster 1998 monotony/strain, duration-weighted intensity mix (RPE 1-3/4-6/7-10), rest days.
- Frontend: `components/LoadAnalyticsSection.js` (method toggle persisted at `@trainwise_acwr_method`, weekly volume, intensity, variety) + `components/AcwrTrendChart.js` (custom react-native-svg — chart-kit cannot shade the sweet-spot band). `utils/loadSeries.js` is the **on-device mirror fallback** when the endpoint is missing/offline — any change to LoadAnalyticsBL math MUST be mirrored there (same rule as utils/acwr.js).
- Chart Y-axis is labeled at the thresholds (0.8/1.3/1.5), zones labeled in plain language; ratios clamp at 3 for scale sanity.

## Time / timezone

The backend stores times exactly as sent (no timezone conversion). The frontend sends UTC via `toISOString()`. Display layers must convert back to local using `toLocaleTimeString('en-US', { ..., timeZone: 'Asia/Jerusalem' })` — do not change the storage format to "fix" displayed times.

## ActivityLog invariants

- Hard-delete only (soft-delete reverted 2026-04-22; `IsDeleted` column dropped from DB; `sp_GetActivityLogsByUser` and `sp_GetActivityLogsForLoad` rewritten without the filter).
- Any screen that creates/updates an ActivityLog MUST set `calculatedLoadForSession = duration × exertion` AND call `calculateDailyLoad(userId, editedDate)` then `calculateDailyLoad(userId, today)` afterwards — otherwise the DailyLoad rows on the server stay stale. `calculateDailyLoad` (services/api.js) sends `tzOffsetMinutes` in the body so the server buckets sessions to the device's local day.
- AC ratio thresholds (strict): `ratio < 0.8` Green, `0.8 ≤ ratio ≤ 1.3` Yellow, `ratio > 1.3` Red. Active injury tightens to Red ≥ 1.2 / Yellow 0.8 ≤ r < 1.2 (no gap) on every surface.
- Unconfirmed rows (`IsConfirmed = 0`, i.e. pending HC imports) never count toward acute/chronic/ratio anywhere; NULL counts as confirmed.
- Warnings dashboard's status / AC ratio / weekly bars are computed client-side from `ActivityLogs`, never from `DailyLoad` rows (those are 7-day rolling snapshots and leak prior-week data).
- Refresh on Warnings must recalc ALL 7 days of DailyLoad (loop i=6..0).

## Theme system

- [theme/colors.js](TrainWiseExpo/src/theme/colors.js) exports a **mutable** `Colors` singleton that is swapped in place by `applyTheme(name)`. Reading `Colors.x` **inside JSX or inside a function called per-render** (e.g. `screenOptions={() => ...}`) always returns the current value because the object reference doesn't change.
- [theme/palettes.js](TrainWiseExpo/src/theme/palettes.js) holds `darkPalette` (default) and `lightPalette` (logo-derived mint/teal/navy + brand pink accent).
- [theme/ThemeContext.js](TrainWiseExpo/src/theme/ThemeContext.js): `<ThemeProvider>` reads `trainwise.theme` from AsyncStorage on mount, exposes `useTheme()` (`{ theme, setTheme }`), and re-mounts its children via a key prop on theme switch.
- **CRITICAL**: `StyleSheet.create()` reads color values **once at module-load time** and freezes them. Mutating `Colors` later does NOT update existing stylesheets, even after a Fragment-key remount (modules stay cached). Therefore every themed screen must use the [useThemedStyles](TrainWiseExpo/src/theme/useThemedStyles.js) hook:
  ```js
  const MyScreen = () => {
    const styles = useThemedStyles(makeStyles);
    return <View style={styles.bg} />;
  };
  const makeStyles = (Colors) => StyleSheet.create({ bg: { backgroundColor: Colors.background } });
  ```
  The hook is `useMemo`-keyed on the active theme and re-runs `makeStyles(Colors)` after `applyTheme` mutates the singleton. **Do not put `StyleSheet.create({...Colors.x...})` at module level** — it will not theme-switch.
- **Themed screens (use `useThemedStyles`)**: As of 2026-06-04 **every screen is themed** — HomeScreen, StatsScreen, ProfileScreen, WarningsDashboardScreen, SettingsScreen, GoogleFitScreen, AddWorkoutScreen, InjuryReportScreen, ActiveInjuriesScreen, CoachDashboardScreen, CoachTraineeDetailScreen, ChatScreen, MyCoachScreen, ConnectQRScreen, and the formerly-branded WelcomeScreen, LoginScreen, SignUpScreen, SignUpFinal, WorkoutSummaryScreen, ShopScreen, AIChatScreen. All shared components (Card, ScreenHeader, PrimaryButton, ComboBox) + DraggableChatBubble.
- **Mapping the old branded palette → tokens** (applied to the onboarding/auth screens): navy `#13173d`→`background`, white inputs `#fff`→`inputBackground`, mint border `#87ffd7`→`inputBorder`, pink `#ff2c60`/`#ff2d6f`→`primary`, purple `#c524e6`→`primaryDark`, teal/cyan accents→`primaryLight`, navy text `#13173d`→`textPrimary`, gray `#a0a0c0`→`textSecondary`. The brand pink stays the `primary` accent in dark; light mode swaps it for the teal palette. CTA button label text and on-`primary` icons are kept literal `#fff` for contrast; coin gold (`#FFD700`) and semantic green stay fixed. Onboarding screens read `useTheme().theme` to flip `<StatusBar>` between `light`/`dark`.
- **Intentionally hardcoded**: `getBarColor()` thresholds in [HomeScreen.js](TrainWiseExpo/src/screens/HomeScreen.js) — green/yellow/orange/red carry semantic meaning and must stay constant across themes.

## Week start

`src/constants/weekStart.js` — single source of truth for which weekday the rolling charts begin on. `initWeekStart()` runs once in `App.js`; `getWeekStartDate(offset)`, `getWeekDayLabels()`, and `subscribeWeekStart(fn)` are the public API. The picker in SettingsScreen calls `setWeekStartDay(idx)` which persists to AsyncStorage and notifies subscribers (WarningsDashboardScreen reactively re-renders the chart). HomeScreen's `dayIndex` is the **JS day-of-week** (Sun=0..Sat=6), not the array position, so labels stay correct under any week start.

## AI chatbot

[AIChatScreen.js](TrainWiseExpo/src/screens/AIChatScreen.js) calls OpenAI directly from the device via [api/openai.js](TrainWiseExpo/src/api/openai.js) using `EXPO_PUBLIC_OPENAI_API_KEY` read from `.env`. The key is **bundled into the APK in plain text** because of the `EXPO_PUBLIC_` prefix — anyone with the APK file can unzip it and extract the key. Acceptable for the school demo; **do not distribute the APK publicly**. If the project ever ships beyond demos, move the call through the backend so the key lives only on Azure.

`.env` is gitignored. If the chatbot returns "API key not configured", the `.env` file is missing or the build didn't pick it up — env vars are baked in at build time, so changing `.env` requires `npx expo run:android --variant release` to take effect.

Chat history is currently in-memory only (`useState` in [AIChatScreen.js](TrainWiseExpo/src/screens/AIChatScreen.js)) — leaving the screen wipes the conversation. Persisting it (AsyncStorage or backend) is a known open item.

## API keys / secrets (do NOT hardcode)

Updated 2026-06-09 after a Google key was leaked via a push (see `tasks/lessons.md` +
`tasks/conversation_resume_2026_06_12.md`). Rules:

- **No API key may be a literal in committed source.** Before every commit, grep staged
  content for `AIza` (Google), `sk-` (OpenAI), `AKIA`, `ghp_`, `xox`, `-----BEGIN`,
  `Password=<value>`. A key leaked to history can only be removed with `git filter-repo
  --replace-text` + force-push, and must be **rotated regardless** (public history).
- **Google key** (Maps SDK + Weather + Air Quality + Places) lives only in
  `TrainWiseExpo/.env` as `GOOGLE_MAPS_API_KEY` (native, injected by `app.config.js`)
  AND `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (the JS-runtime fetch calls — only
  `EXPO_PUBLIC_`-prefixed vars are inlined into the bundle). `app.json`'s
  `android.config.googleMaps.apiKey` is an EMPTY placeholder; `app.config.js` overrides
  it from the env var at build time. `weatherService.js` reads from
  `Constants.expoConfig...googleMaps.apiKey` / `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`,
  never a literal. **Restrict the key by API only, not "Android apps"** (an Android-app
  restriction 403s the REST calls). `.env.example` documents the vars; `.env` is gitignored.
- **OpenAI key**: `EXPO_PUBLIC_OPENAI_API_KEY` in `.env` (baked into the APK in plaintext
  like all `EXPO_PUBLIC_` vars; don't distribute the APK publicly).

### Other live secrets + safe-push checklist (added 2026-06-24)

- **`TrainWise/TrainWise/appsettings.json` is the second live secret** (after the Google
  key). Its **working copy carries the Azure SQL password** (`...User ID=TrainWiseAdmin;
  Password=<REDACTED>;...`) for whatever Azure session is active, but the **committed
  version on `Lirone's-Branch` has only the clean LOCAL string**
  (`Data Source=Lirone\SQLEXPRESS;...;Integrated Security=True`, no password). It is a
  **tracked** file, so `.gitignore` can't protect it — a blind `git add -A` WILL stage the
  password. **Always** do: `git add -A` → `git restore --staged TrainWise/TrainWise/appsettings.json`,
  then verify with `git show <commit>:TrainWise/TrainWise/appsettings.json` (must show the
  local string). Never edit the working file to "fix" it — it's the user's local Azure config.
- **Never commit these** (already in `.gitignore` as of 2026-06-24): `sql/full_data_insert.sql`
  + `sql/export_all_data.sql` (full live-DB dumps with REAL user emails + password column
  values), `Python Course ML/` (~70MB unrelated ML-course homework), `tasks/design_backups/`
  (duplicate copies of source — git history is the backup), `ml/models/*.pkl` (regenerable
  by the notebook; `ml/models/` keeps only `.gitkeep`). `TrainWiseExpo/android/` (incl.
  `google-services.json`, the Firebase config) is git-ignored wholesale, so native secrets
  never leak. The repo needs only **schema** (`TWDB.sql` / `TrainWiseV2.sql` / migrations) +
  `seed_reference_data.sql` — any `*_data_insert` / `*dump*` file is runtime data, not schema.
- **Safe-push procedure** (the project owner is extremely sensitive about this after the
  Google-key leak): (1) `git fetch` + compare local vs `origin/<branch>` to scope the push;
  (2) scan the WORKING tree for secrets with the Grep tool (ripgrep skips gitignored files);
  (3) add any junk/PII/secret files to `.gitignore`; (4) `git add -A` then `git restore
  --staged` the appsettings.json (and any other tracked-with-local-secret file); (5) scan the
  **staged diff** AND the **committed tree** (`git grep -nEi "<patterns>" <commit>` — scan the
  COMMIT, not the working tree, or the staged-out password gives false alarms) for:
  `AIza` `sk-` `AKIA` `ghp_` `xox` `ya29.` `-----BEGIN` `private_key` `client_secret`
  `Password=<literal>` `database.windows.net` `Data Source=` `Server=tcp:`; (6) only then commit
  + push to the user's own feature branch.
- **Not blocking** (present in history, NOT usable credentials): the public Azure API URL
  (`trainwise01-api-…azurewebsites.net` — baked into the APK anyway), the Azure SQL **server
  hostname + admin username** (`trainwiseadmin.database.windows.net` / `TrainWiseAdmin`, in
  docs/comments — useless without the password + the Azure firewall allowlist), and the **demo
  seed accounts** (`demo1234` on **non-routable `@trainwise.demo`** emails in
  `sql/2026-06-08_add_social.sql` — intentional fake data). Distinguish a usable live credential
  (BLOCK) from a throwaway demo on a fake domain (DISCLOSE, don't block).

## HC tombstones

Health Connect itself is read-only for third-party apps (TrainWise can't delete records that Samsung Fit wrote). Without intervention, every auto-sync re-imports any HC workout the user just deleted from the backend. [src/constants/hcTombstones.js](TrainWiseExpo/src/constants/hcTombstones.js) keeps a persistent set of normalized HC startTime keys (minute-granular, matching `SyncService.areWorkoutsDuplicate`). When the user deletes an HC-source workout in [GoogleFitScreen.js](TrainWiseExpo/src/api/GoogleFitScreen.js), its key is added to the set; `SyncService.deduplicateWorkouts` filters tombstoned keys before posting. Manual logs bypass tombstoning since they have no HC counterpart.

## User roles (coach / trainee / both)

As of 2026-06-02, the `Users` table has TWO independent role booleans:
- `IsCoach` — user can act as a coach (sees CoachDashboardScreen, can connect to trainees).
- `IsTrainee` — user has training screens (Home dashboard, Health tab, AddWorkout, personal Warnings, training rows on Profile).

Both flags are set at signup from the SignUpScreen role picker (`'trainer' | 'trainee' | 'both'`):
- `'trainer'` → `IsCoach=1, IsTrainee=0` (coach-only)
- `'trainee'` → `IsCoach=0, IsTrainee=1`
- `'both'` → `IsCoach=1, IsTrainee=1`

**Coach-only gating:**
- [NavigationStack.AppTabs](TrainWiseExpo/src/navigation/NavigationStack.js) hides the **Load and Health tabs** when `isCoach && !isTrainee` (coach-only users see Home + Connect).
- [HomeRouter](TrainWiseExpo/src/screens/HomeRouter.js) renders CoachDashboardScreen directly (no toggle) for coach-only users.
- [ProfileScreen](TrainWiseExpo/src/screens/ProfileScreen.js) hides Activity Level / Experience Level / Height / Weight rows for coach-only.

Existing rows from before 2026-06-02 default to `IsTrainee=1` via the column's `DEFAULT 1` — they keep all their screens. UserDAL.MapUser uses `SafeReadBool(reader, "IsTrainee", true)` so it tolerates SPs that haven't been updated to include the column in their SELECT lists.

**Coach row lazy-create (RESOLVED):** `UserBL.Create` only inserts into the `Coaches` table when `IsCoach=true` at signup time, but [CoachBL.GetCoachByUserId](TrainWise/TrainWise/BL/CoachBL.cs) now **lazy-creates** the Coaches row on first read for any user with `IsCoach=1` — so a trainee who flips to coach later gets a working QR Connect flow without a manual INSERT. (`sp_RespondCoachOffer` does the same on coach-offer accept.)

## Coach ↔ trainee chat (messages)

Added 2026-06-04 (#6), image support 2026-06-07 (#9). WhatsApp-style chat that is **user↔user, not coach↔trainee** — both `senderID` and `receiverID` are `Users.UserID`. The coach/trainee link only decides who *can* see whom in the UI; the message rows themselves are just between two users.

- **DB**: `Messages` table + `sp_InsertMessage` / `sp_GetConversation` / `sp_MarkMessagesSeen` / `sp_GetUnreadMessageCount` ([sql/2026-06-04_add_messages.sql](sql/2026-06-04_add_messages.sql)). Image chat adds `Messages.ImagePath NVARCHAR(300) NULL` and updates the two read/insert procs ([sql/2026-06-07_add_message_image.sql](sql/2026-06-07_add_message_image.sql)). `SentAt` is stored UTC but serialized **without a 'Z'** — the frontend appends 'Z' before parsing then renders in `Asia/Jerusalem` (mirror the `toLocalTime` helper, don't "fix" storage).
- **Backend**: `MessagesController` — `POST /api/messages`, `GET /api/messages/conversation/{a}/{b}` (oldest first), `PUT /api/messages/seen/{senderId}/{receiverId}`, `GET /api/messages/unread/{userId}`, and `POST /api/messages/upload` (IFormFile → `wwwroot/images/chat_*`, returns `{ path }`, same `WebRootPath` rule as profile upload). The 2026-06-28 green batch added a **typing indicator** (`PUT/GET /api/messages/typing/{fromUserId}/{toUserId}`, one `MessageTyping` row per pair) and **emoji reactions** (`POST /api/messages/{messageId}/react/{userId}`, `GET /api/messages/reactions/{userA}/{userB}`, `MessageReactions` table — one per user per message). **`SendMessageRequest.Text` and `.ImagePath` are `string?`** — nullable refs are ON, so a plain `string` would be implicitly `[Required]` and 400 every text-only message (see lessons 2026-06-07). `MessageBL` allows image-only (empty Text).
- **Frontend client** ([services/api.js](TrainWiseExpo/src/services/api.js)): `sendMessage` (text:'' / imagePath:null defaults), `getConversation`, `markMessagesSeen`, `getUnreadMessageCount`, `uploadChatImage` (raw fetch multipart), `getCoachesForTrainee`. Message field accessors are dual-cased (`m.senderID ?? m.SenderID`, `isSeen ?? IsSeen`, etc.).
- **Chat UI** ([ChatScreen.js](TrainWiseExpo/src/screens/ChatScreen.js)): focus-gated 4s poll, auto-marks incoming messages seen (read receipts), image bubbles + full-screen viewer. `errText()` extracts the real axios error (never render the raw body — it stringifies as "[object Object]").
- **Unread badge / notifications**: [MessagesContext.js](TrainWiseExpo/src/api/MessagesContext.js) is a global 12s poller exposing `unreadCount` + firing a generic local notification when the **total** count rises. It does NOT know the sender — naming the coach in the notification would need an unread-by-sender endpoint.
- **Trainee side — multiple coaches** (2026-06-08): a trainee can be linked to **more than one coach**. [MyCoachScreen.js](TrainWiseExpo/src/screens/MyCoachScreen.js) fetches `getCoachesForTrainee(selfId)` itself: with 2+ coaches it renders a selectable inbox list (avatar + name + last-message preview + **per-coach unread badge**) → tap → per-coach detail (identity / Message / disconnect); with exactly 1 coach it auto-selects to detail; header back returns to the list when multiple. **Per-coach unread is derived client-side** by counting unseen messages from each coach in `getConversation` (cheap — a trainee has few coaches), so there is no backend per-sender endpoint. Don't regress this back to a single `coaches[0]` + global badge.
- **Coach side** lists trainees via `getTraineesByCoach` (CoachDashboardScreen) and opens the same ChatScreen per trainee.
- **Floating bubble**: [DraggableChatBubble.js](TrainWiseExpo/src/components/DraggableChatBubble.js) exists but is OFF (`SHOW_COACH_BUBBLE=false` in HomeScreen) — unread is shown as a badge on the "My coach" button instead. Flip the flag to bring it back.

## Connect / social layer (friends, gyms, presence, coach offers)

Added 2026-06-08 (#3). A whole vertical slice — SQL → C# → RN. Migration:
[sql/2026-06-08_add_social.sql](sql/2026-06-08_add_social.sql) (idempotent;
**must run after `seed_reference_data.sql`** — its fake-user seed references ActivityTypeIDs 1–6).

- **DB**: `Friendships` (RequesterID/AddresseeID/Status pending|accepted|declined — ONE row per pair, either direction), `Gyms` + `GymCoaches` (gym↔coach recommendation link, CoachUserID = Users.UserID), `CoachOffers` (coach→trainee "need a coach?"), and `Users.LastSeen` / `Latitude` / `Longitude`. Distance uses `geography::Point(lat,lng,4326).STDistance(...)`; "online" = `LastSeen` within **5 minutes**. ~20 stored procs, all `CREATE OR ALTER`. The seed adds 6 fake trainees + 4 fake coaches near **Netanya (32.3215, 34.8532)** + **10 REAL Netanya gyms harvested from the Google Places API** (name + Address + Lat/Lng all from Google so the pin and address always agree — fixes the address-mismatch class of bug): Profit Gym, G 24/7, Holmes Place Natanya, Greenbody, Icon Fitness Netanya, FITTR, Collegym, Shmeps Fit, Reborn, Profit Kiryat HaSharon. They cover the user's city and reach Ruppin Academic Center (~6km NE). Gyms are **demo-only reference data** (no UI creates them), so the seed **wipes `Gyms` + `GymCoaches` and reseeds** each run (converges; any coach self-listing is rebuilt). The Connect query radius is **25km** (Netanya + Ruppin, local). `Gyms.City` exists but the Connect filter is now type+sort (see frontend). The fake people are **real loginable accounts, password `demo1234`** (use a second login to demo the accept side of friend/coach flows).
- **Backend**: `SocialController` (`api/social/...`) + `GymsController` (`api/gyms`). Three-layer as usual: `SocialBL`/`SocialDAL`, `GymBL`/`GymDAL`, projection POCOs in [Models/SocialModels.cs](TrainWise/TrainWise/TrainWise/Models/SocialModels.cs). DAL readers use a defensive `Has(reader,col)` so procs whose final SELECT omits a column (e.g. `sp_RespondCoachOffer`) still map. `sp_RespondCoachOffer` lazy-creates the `Coaches` row + the `CoachTrainees` link on accept (mirrors `CoachBL`).
- **Presence is a real heartbeat**: [SocialContext.js](TrainWiseExpo/src/api/SocialContext.js) (global provider in [NavigationStack.AppStack](TrainWiseExpo/src/navigation/NavigationStack.js)) PUTs `/social/presence/{userId}` every 60s while foregrounded, and polls the inbox every 25s. When friend-requests / accepted-friends / coach-offers grow vs the last poll it fires a local push, so **both sides get notified** (the accepter pushes immediately in [RequestsScreen.js](TrainWiseExpo/src/screens/RequestsScreen.js); the requester's poller detects the new friend). Known gap: a coach is NOT pushed when their offer is accepted (the trainee just appears in their dashboard).
- **Frontend**: [ConnectScreen.js](TrainWiseExpo/src/screens/ConnectScreen.js) = the Connect tab. The map plots **gyms only** — other users' exact coordinates are NEVER shown on the map (privacy, 2026-06-09); people appear only as a proximity-sorted LIST without distances. expo-maps is lazy-required like WorkoutRouteScreen so it degrades to a list; gym markers carry `id` `gym-N` and route via `onMarkerClick`; falls back to Netanya center if location denied; **25km query radius** (covers Netanya + Ruppin Academic Center, local). The map is **resizable** (a PanResponder drag handle between the map and the list adjusts map height with a draggable bar). A **filter icon** (not a search box) opens a menu: **Show** Trainees / Coaches / Gyms, **Sort by** Nearest / Name(A-Z). Detail sheets: a user mini-profile (training level + top-3 activities + presence) with Add-friend / Message / Unfriend + (coach viewer) Offer-to-coach; a gym sheet with recommended coaches (tapping a coach **opens their profile to Add-friend — no chat-before-connected**) + (coach viewer) "recommend me here". The smart-suggestion card (AddWorkout) and the coach-recommendations card (Warnings) are **collapsible** (LayoutAnimation, chevron indicator); the coach card shows a red **unseen-count** badge cleared on open (persisted per-account in AsyncStorage). [RequestsScreen.js](TrainWiseExpo/src/screens/RequestsScreen.js) = accept/decline inbox. [MyCoachScreen.js](TrainWiseExpo/src/screens/MyCoachScreen.js) was rewritten as the **My Network hub** — swipe (paged ScrollView) between **Coaches** and **Friends**, per-contact unread badges (derived client-side from `getConversation`, same as before), green presence dots on friends, row→chat, trailing menu→disconnect/unfriend. Friend chat reuses the generic [ChatScreen.js](TrainWiseExpo/src/screens/ChatScreen.js) (`selfId`/`peerId`/`peerName`/`peerImagePath`) — friends are real DB users so it's the same `Messages` backend. Reusable [components/Avatar.js](TrainWiseExpo/src/components/Avatar.js) draws the avatar + optional online dot; [utils/experience.js](TrainWiseExpo/src/utils/experience.js) maps `ExperienceLevel` (tinyint 1/2/3) → Beginner/Regular/Advanced + a `lastSeenText` helper.
- All social API helpers live in [services/api.js](TrainWiseExpo/src/services/api.js) (SOCIAL / FRIENDS / COACH OFFERS / GYMS sections). Field accessors are dual-cased but the backend serializes camelCase.
