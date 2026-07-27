# Session 2026-06-08 — what shipped + what YOU must run

This session shipped 5 things. Items 1, 2, 4, 5 are **JS-only** (Metro `r`). Item 3
(the Connect tab) needs a **DB migration + backend restart + APK rebuild**.

## TL;DR action list (do these to make everything live)

1. **Run the new SQL migration** on the local DB (SSMS → `Lirone\SQLEXPRESS` / `TrainWise`):
   - `c:\Dev\TrainWise\sql\2026-06-08_add_social.sql`
   - It is idempotent (safe to re-run). It needs `seed_reference_data.sql` to have run first
     (the fake activity logs reference ActivityTypeIDs 1–6).
   - Also make sure the earlier pending migration ran: `c:\Dev\TrainWise\sql\2026-06-07_add_message_image.sql`.
2. **Restart the backend** in VS 2022 (rebuild + run). New controllers: `SocialController`, `GymsController`.
   - Verify in Swagger that `/api/social/...` and `/api/gyms` appear.
3. **Confirm the LAN IP** still matches both axios clients. As of now both are
   `http://192.168.1.119:5249/api` ([src/api/api.js](TrainWiseExpo/src/api/api.js) +
   [src/services/api.js](TrainWiseExpo/src/services/api.js)). If the app shows "Network Error",
   `ipconfig | findstr IPv4` and update BOTH.
4. **Rebuild the APK** (`npx expo run:android --variant release`) — the Connect map uses the
   native **expo-maps** module and location. (Pure-JS items 1/2/4/5 don't need this, but the
   Connect tab does for the map.)
5. **Enable the Google Air Quality API** (optional, for the IQA factor in the smart card) on the
   same project as Maps/Weather (`test01`, #469392409228), and link billing. Without it the air
   factor just hides — everything else in the card still works. (Weather API enable is still
   pending from last session for the temp/humidity/UV/wind factors.)

## How to demo the social feature on ONE phone

The seeded fake users are **real, loginable accounts** (password `demo1234`). So:
- As **yourself** (trainee): Connect tab → tap a nearby athlete → **Add friend**.
- On a **second device/emulator**, log in as e.g. `maya.cohen@trainwise.demo` / `demo1234` →
  Connect → bell (Requests) → **Accept**. Both phones get a push, both now see each other under
  **My Network → Friends**, and can chat.
- Coach flow: log in as a coach demo account (`avi.shapiro@trainwise.demo` / `demo1234`), Connect
  tab → tap a trainee → **Offer to coach this athlete**; accept it on the trainee device.

---

## 1. Smart workout card redesign (#1) — JS only
- [AddWorkoutScreen.js](TrainWiseExpo/src/screens/AddWorkoutScreen.js): the "Smart suggestion"
  block is now a distinct **accent-bordered, glowing card** (not a plain `<Card>`) with a rating
  pill (Great/Good/Fair/Poor + score/100) and a **color-coded factor grid**.

## 2. Multi-factor smart workout (#2) — JS only
- [weatherService.js](TrainWiseExpo/src/api/weatherService.js) now returns humidity, wind, UV,
  feels-like, precipitation, cloud cover + a separate **Air Quality** fetch (IQA).
- [smartWorkout.js](TrainWiseExpo/src/utils/smartWorkout.js) scores temp + humidity + UV + wind +
  air + rain into an overall rating; every factor degrades gracefully if its datum is missing.

## 3. Connect tab — gyms, nearby people, friends, coach offers (#3) — **needs migration + rebuild**
- New bottom tab **"Connect"** between Health and Profile (visible to trainees AND coaches).
- Map (expo-maps) of nearby **gyms** + **people**; tap a pin or list row for a detail sheet.
  The **map is resizable** (drag the divider) and there's a **filter box** (name / gym / city).
- **People** → quick profile (training level + top-3 workout types + presence dot) → **Add friend**.
  Coaches additionally see **"Offer to coach this athlete"**.
- **Gyms** are **10 REAL Israeli gyms** (Netanya / Tel Aviv / Herzliya / Ra'anana / Kfar Saba)
  pulled from the Google Places API, so the address always matches the map pin. Tap a gym → info +
  **recommended coaches**; tapping a coach opens their profile to **Add friend** (no chat-before-
  connected). Coaches can **list themselves** at a gym. Re-running the migration replaces the old
  placeholder gyms with these.
- **Requests** inbox (bell icon) → accept/decline friend requests + coaching offers. Accepting fires
  a push to BOTH sides.
- **My Network** hub (renamed from "My coach", reached from Home button or Connect header):
  swipe between **Coaches** and **Friends**, per-contact unread badges, green **online dots**,
  chat + disconnect/unfriend.
- **Presence**: [SocialContext.js](TrainWiseExpo/src/api/SocialContext.js) heartbeats every 60s and
  polls the inbox every 25s (firing the "new friend / new request / new coach" pushes).

## 4. Injury scanner + AI advice (#4) — JS only (AI needs the OpenAI key to actually answer)
- [InjuryReportScreen.js](TrainWiseExpo/src/screens/InjuryReportScreen.js) symptoms card now has
  **Scan injury (photo)** (camera/library), **AI advice** (built on the existing OpenAI helper —
  returns "not configured" until the key works, as expected), and **Send to coach** (routes the
  scan + summary through the existing chat to all linked coaches).

## 5. Sign-up age 18–75 (#5) — JS only
- [SignUpScreen.js](TrainWiseExpo/src/screens/SignUpScreen.js): age wheel is now 18–75 (default 25).

---

## Known follow-ups (not blocking)
- A coach is NOT pushed when a trainee accepts their offer (the new trainee just appears in the
  coach dashboard / My Network). Add `getSentCoachOffers` polling to SocialContext if you want it.
- Fake demo users' presence dots go grey 5 min after the seed (no heartbeat). Real users stay green.
- OpenAI key still not configured → AI injury advice + AI chat both return the placeholder string.
