# Conversation resume — 2026-06-07 → 2026-06-08

Carry-over brief for a fresh Claude session. Anything not in this doc, read CLAUDE.md and tasks/lessons.md first.

## Why this doc exists

A long multi-feature session (2026-06-07, continued into 2026-06-08) shipped a large batch of bug fixes + features on top of the Local-LAN backend setup, then closed with a **multi-coach trainee chat inbox**. This captures the state so the next session starts without re-reading the transcript.

## Backend mode (unchanged, important)

Still **Local LAN mode** (Azure subscription dead — see CLAUDE.md Mode A/B). Backend runs in VS 2022 bound to `http://0.0.0.0:5249`, local SQL Express `Lirone\SQLEXPRESS` / DB **TrainWise**. Both axios clients ([src/api/api.js](TrainWiseExpo/src/api/api.js) + [src/services/api.js](TrainWiseExpo/src/services/api.js)) MUST share the same `BASE_URL`. As of the last edit both are `http://192.168.1.119:5249/api` (home IP). **The PC IP changes with DHCP** — re-check with `ipconfig | findstr IPv4` if the app shows Network Error, and update BOTH files. `adb reverse tcp:5249 tcp:5249` + `127.0.0.1` is the WiFi-independent fallback (used at school when device-to-device was blocked).

> Diagnostic gotcha: the Bash/PowerShell tool runs **sandboxed** and can't see the host's loopback listeners — pass `dangerouslyDisableSandbox: true` for real `netstat`/`curl` against the running backend, or you get false "nothing listening" / status 000.

## What shipped this session

### Coach ↔ trainee chat (#6) and follow-ups
- WhatsApp-style user↔user chat: [ChatScreen.js](TrainWiseExpo/src/screens/ChatScreen.js), backend `Messages` table + procs ([sql/2026-06-04_add_messages.sql](TrainWise/sql/2026-06-04_add_messages.sql)).
- **#9 image chat:** `Messages.ImagePath` column ([sql/2026-06-07_add_message_image.sql](TrainWise/sql/2026-06-07_add_message_image.sql)), `POST /api/messages/upload` (fetch multipart → `wwwroot/images/chat_*`), image bubbles + full-screen viewer.
- **Send-error fix:** backend has nullable refs ON, so plain `string` DTO props are implicitly `[Required]` → text-only messages (imagePath:null) 400'd with "ImagePath field is required" (shown as "[object Object]"). Fixed: `SendMessageRequest.Text`/`ImagePath` → `string?`; `errText()` in ChatScreen extracts `d.errors/d.title/d.message`.
- **#1 in-app banner:** [components/InAppBanner.js](TrainWiseExpo/src/components/InAppBanner.js) (`showInAppBanner`), provider in App.js. Clickable → `navigate('HomeTab',{screen:'Warnings'})` via [navigation/navigationRef.js](TrainWiseExpo/src/navigation/navigationRef.js).
- **#8 coach chat off Home:** `SHOW_COACH_BUBBLE=false` in HomeScreen; unread now badges the "My coach" button + the MyCoachScreen Message button instead of the floating bubble. Flip the flag to restore [DraggableChatBubble.js](TrainWiseExpo/src/components/DraggableChatBubble.js).
- **#10 disconnect** both sides, **#7 QR swipe**, **#2 immediate connect notification**, **#3 AI bubble icon → sparkles**, **#5 long-press Shop coin balance → grant 10,000** (`grantCoins`, coins are device-local AsyncStorage, NOT DB).

### #6 false-overload (cold-start ACWR) fix — IMPORTANT
A new user's lone workout sits in both the acute(7d) and chronic(28d) windows → chronic = acute/4 → ratio always 4.0 → false Red. Fixed in **backend** [LoadCalculationBL.cs](TrainWise/TrainWise/TrainWise/BL/LoadCalculationBL.cs) AND **client** [WarningsDashboardScreen.js](TrainWiseExpo/src/screens/WarningsDashboardScreen.js): until baseline established (≥7 training days), floor chronic at experience-based bootstrap weekly (Beginner 150 / Regular 280 / Advanced 420). Coach view self-heals via a 7-day recompute in [CoachTraineeDetailScreen.js](TrainWiseExpo/src/screens/CoachTraineeDetailScreen.js). **Needs backend restart to take effect.**

### #11 weather-based smart workout
- [api/weatherService.js](TrainWiseExpo/src/api/weatherService.js) — Google **Weather API** (`weather.googleapis.com/v1/currentConditions:lookup`), uses the Maps key, expo-location coords, 1h AsyncStorage cache. **Weather API is a SEPARATE SKU from Maps SDK — does NOT consume the map-load quota.**
- [utils/smartWorkout.js](TrainWiseExpo/src/utils/smartWorkout.js) — weather+AC → suggestion (AC>1.3 overrides to recovery; wet/cold→indoor, hot→swim, else outdoor).
- [AddWorkoutScreen.js](TrainWiseExpo/src/screens/AddWorkoutScreen.js) — "Smart suggestion" card with tappable activity chips.
- Added **expo-location** (native dep) + `ACCESS_COARSE/FINE_LOCATION` to AndroidManifest → **needs APK rebuild**.

### Multi-coach trainee inbox (2026-06-08) — most recent
A trainee can be linked to **more than one coach**. [MyCoachScreen.js](TrainWiseExpo/src/screens/MyCoachScreen.js) was single-coach (HomeScreen passed `coaches[0]`, global unread badge), so the trainee couldn't tell which coach messaged or open a 2nd coach's chat. **Rewrote it as an inbox:** fetches `getCoachesForTrainee(selfId)` itself; with 2+ coaches shows a selectable list (avatar + name + last-message preview + **per-coach unread badge**) → tap → per-coach detail (identity / Message / disconnect); exactly 1 coach auto-selects to detail; header back returns to the list when multiple. **Per-coach unread is derived client-side** (loops `getConversation(selfId, coachUserId)`, counts `senderID===coachUserId && !isSeen`) — no backend per-sender endpoint. Focus + 8s poll keeps badges live. **JS-only (Metro `r`).**

## Pending user actions (do/verify next session)

1. **Run [sql/2026-06-07_add_message_image.sql](TrainWise/sql/2026-06-07_add_message_image.sql)** on the local DB + **restart the backend** — needed for chat send (#6 nullable fix), image chat (#9), and the cold-start ACWR fix.
2. **Enable the Weather API** in Google Cloud Console for project **test01** (project number **469392409228** — the SAME project as the Maps key; verified via IAM → Settings showing name `test01` / number `469392409228`). The earlier "card not showing" was a `403 SERVICE_DISABLED`, not a code bug. Linking a billing account is required + safe (free monthly credit covers the ~1-call/hour cached usage). After enabling, the Smart suggestion card appears with no rebuild.
3. **Rebuild the APK** (`npx expo run:android --variant release`) for: expo-location + location permission in the manifest, and any pure-native changes. Pure-JS changes (incl. the multi-coach inbox) only need Metro `r`.
4. **OpenAI key rotation** (long-standing) — still not done; `EXPO_PUBLIC_*` is baked into the APK in plaintext, don't distribute the APK publicly.

## HC quirks confirmed this session

- **HC workout not importing on pull-to-refresh** = the 30s `AUTOSYNC_THROTTLE_MS` in [HealthSyncContext.js](TrainWiseExpo/src/api/HealthSyncContext.js) skipped the actual `triggerSync` (a sync almost always ran <30s ago on foreground). Fix: `runAutoSync(force)` bypasses the throttle; [GoogleFitScreen.js](TrainWiseExpo/src/api/GoogleFitScreen.js) `onRefresh` calls `runAutoSync(true)`. The connect-time floor is NOT the blocker (a same-day workout is always within the 7-day window). HC workouts import as **Pending** (isConfirmed=false) → show on the Health tab with a confirm action.
- If an HC workout still doesn't import after a forced refresh, it's deeper (HC permission or `getStructuredWorkouts`) — add a visible sync-result / logging and read device logs.

## Reference seed data captured

Reference seed data was never in the repo. Now in [sql/seed_reference_data.sql](TrainWise/sql/seed_reference_data.sql) (IF NOT EXISTS-guarded): 20 ActivityTypes w/ IntensityFactors, 20 InjuryTypes, 20 InjuryCategories, 20 TrainingGoals, 1 LoadParameters row. Full values + fresh-DB run order are in CLAUDE.md. Dump live data with [sql/export_all_data.sql](TrainWise/sql/export_all_data.sql).

## Known open follow-ups

- **Message notification doesn't name the coach** — the global [MessagesContext.js](TrainWiseExpo/src/api/MessagesContext.js) poller only knows the total unread count, so the local notification says generic "New message 💬". In-app per-coach badges now show which coach. Naming the sender needs an unread-by-sender backend endpoint OR per-contact polling.
- **Coach row backfill** — `UserBL.Create` only inserts into `Coaches` when IsCoach=true at signup; trainee→coach flips are stuck until backfilled (lazy-create in CoachBL is the fix).
- **#12 route maps** — BUILT earlier (expo-maps, see 2026-06-03 resume); confirm still working after rebuilds.
- **Azure wwwroot persistence** — only relevant if Azure mode is reactivated.

## Files to read at start of next session

1. `CLAUDE.md`
2. `tasks/lessons.md`
3. This file
4. `src/services/api.js` (canonical axios client + all message/coach endpoints)
5. `src/screens/MyCoachScreen.js` (the multi-coach inbox — most recently changed)

## Memory pointers (auto-memory, current)

- `project_trainwise_session_2026_06_04.md`
- `project_trainwise_session_2026_06_07.md` (covers this whole session incl. the multi-coach inbox addendum)
