# Conversation resume — 2026-06-08 → 2026-06-12

Carry-over brief for a fresh Claude session. Read `CLAUDE.md` and `tasks/lessons.md`
first, then this file. This session: a huge feature build (#3 Connect social tab + 4
others), a batch of UX modifications, a **Google API-key leak + full history purge +
rotation**, and APK-build/distribution troubleshooting.

## Backend mode (unchanged)
Still **Local LAN** (Azure subscription dead). Backend in VS 2022 at `http://0.0.0.0:5249`,
SQL Express `Lirone\SQLEXPRESS` / DB `TrainWise`. Both axios clients ([api/api.js],
[services/api.js]) = `http://192.168.1.119:5249/api` (verified = the PC's current IP).
Backend confirmed listening on `0.0.0.0:5249`.

## What shipped this session (all code is committed + pushed to origin/Lirone's-Branch)

### Big feature: Connect tab (#3) — REAL backend, friends/gyms/presence/coach-offers
Full vertical slice SQL→C#→RN. Migration **`sql/2026-06-08_add_social.sql`** (idempotent;
run AFTER `seed_reference_data.sql`). See the "Connect / social layer" section in CLAUDE.md.
- DB: `Friendships`, `Gyms` (+ `City`), `GymCoaches`, `CoachOffers`, `Users.LastSeen/Latitude/Longitude`. ~20 procs. geography distance; "online" = LastSeen < 5 min.
- Seed: 6 fake trainees + 4 fake coaches (real loginable accounts, password `demo1234`) + **10 REAL Netanya gyms harvested from Google Places** (the seed WIPES + reseeds Gyms/GymCoaches each run). Query radius 25km (Netanya + Ruppin).
- Backend: `SocialController` + `GymsController`, `SocialBL/DAL`, `GymBL/DAL`, `Models/SocialModels.cs`.
- Frontend: `ConnectScreen.js` (map = GYM pins only, no user locations for privacy; people are a proximity LIST; resizable map via PanResponder; filter icon→menu Trainees/Coaches/Gyms + Nearest/A-Z), `RequestsScreen.js` (accept/decline inbox), `MyCoachScreen.js` rewritten as **My Network hub** (swipe Coaches⇄Friends, online dots, chat, disconnect/unfriend), `SocialContext.js` (60s presence heartbeat + 25s inbox poll firing pushes), `components/Avatar.js`, `utils/experience.js`. Home "My coach" button → "My network" (route `MyNetwork`). Friend chat reuses ChatScreen.

### #1+#2 smart workout — multi-factor + collapsible card
`weatherService.js` pulls Weather API + Air Quality API (temp/feels-like/humidity/wind/UV/precip + AQI). `smartWorkout.js` scores 6 factors → Great/Good/Fair/Poor. `AddWorkoutScreen.js` renders a distinct **collapsible** accent card (LayoutAnimation, chevron) with a rating pill + factor grid. Headline shows ACTUAL temp (not feels-like).

### #4 injury scanner + AI advice
`InjuryReportScreen.js` symptoms card: Scan-photo (camera/library), AI advice (existing `openai.js`), Send-to-coach (routes scan + summary through chat).

### #5 signup age 18–75. #7 Warnings dashboard: removed Add-Workout/Report-Injury/Settings buttons; coach recommendations now **foldable** with an unseen red-dot badge (AsyncStorage-persisted). Em-dashes removed from user-facing text ([[no-em-dashes]] preference).

## SECURITY INCIDENT — Google API key leak (RESOLVED)
- The Google key `AIza...` was hardcoded in `app.json` + `weatherService.js` and got pushed to GitHub.
- **Fixed:** key moved to `.env` (gitignored). New `app.config.js` injects it into the native build from `GOOGLE_MAPS_API_KEY`; `app.json` apiKey is now an empty placeholder; `weatherService.js` reads from config / `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (no literal). New `.env.example` documents the vars.
- **History purged:** used `git filter-repo --replace-text` to scrub the key from EVERY commit of `Lirone's-Branch`, force-pushed (only that branch; main/Dana/Yuval untouched + confirmed clean). Backup bundle at `C:\Dev\trainwise-pre-purge.bundle` (local, has old history; safe to delete once confirmed).
- **User rotated the key** in Google Cloud (project `test01`) and added it to `.env` as `GOOGLE_MAPS_API_KEY` + `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Teammates with `Lirone's-Branch` must re-clone or `git reset --hard origin/Lirone's-Branch` (history was rewritten).

## OPEN / IN-PROGRESS

1. **Smart card still not appearing on device.** The key + APIs are confirmed working (curl returned HTTP 200 weather + AQI). Cause is client-side: the app build must include `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (now in `.env`) — needs a rebuild — AND/OR location permission must be granted on the phone, AND the new key must NOT have an Android-app restriction (it blocks the REST calls). A **temporary debug banner** is added in `AddWorkoutScreen.js` (UNCOMMITTED local change) that shows the real weather error when the card is hidden — rebuild and read it, then remove the banner.
2. **APK rebuild trouble.** `gradlew assembleRelease` said SUCCESSFUL but didn't repackage (up-to-date); `clean assembleRelease` is the fix but the last clean build's result was unverified (APK still dated 2026-06-09). The current Desktop `TrainWise.apk` IS the June 9 build and **its baked URL is Local-LAN `192.168.1.119`** (verified by unzipping the bundle) — so it works for same-WiFi login/social/chat, but its map+weather use the OLD (deleted) key. For a fully-working build run `npx expo run:android --variant release` (prebuild injects the new manifest key + bundles EXPO_PUBLIC). APK path: `TrainWiseExpo/android/app/build/outputs/apk/release/app-release.apk`.
3. **Distribution:** Local-LAN APK only works for devices on the same WiFi as the PC with the backend running. Remote testers need a public backend (reactivate Azure or a tunnel).
4. Untracked local files (NOT committed): `TrainWise.zip` (a project zip, junk), `sql/TrainWiseV2.sql` (a DB export the user added — review before relying on it).

## Files to read at start of next session
1. `CLAUDE.md`  2. `tasks/lessons.md`  3. this file
4. `src/api/weatherService.js` + `app.config.js` + `.env.example` (key handling)
5. `src/screens/ConnectScreen.js` + `src/screens/MyCoachScreen.js` (most recent feature)

## Memory pointers (auto-memory)
- `project_trainwise_session_2026_06_08.md` (the Connect build)
- `feedback_no_em_dashes.md`
- `feedback_never_commit_api_keys.md` (the key-leak lesson)
