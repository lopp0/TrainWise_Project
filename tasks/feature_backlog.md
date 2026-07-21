# TrainWise — Feature Backlog & Implementation Specs

> **Purpose:** a pick-up-and-build backlog. Each entry has enough detail for a *fresh* Claude Code
> session to start the task without re-discovery. These are **proposed / not yet built** (the 109
> shipped features live in [`docs/featureslist.md`](../docs/featureslist.md) on `main`).

## How a future session should use this file
1. **Read `CLAUDE.md` first** (architecture, HC native rules, secrets/safe-push, build commands).
2. Pick a feature by **ID** below. Confirm scope with the user before native/DB/Azure changes.
3. Follow the existing patterns the spec references (three-layer backend, `useThemedStyles`, dual-cased
   field accessors, `[FromBody]`, nullable `string?` on optional DTO fields, migrations in `sql/`).
4. **Validate** JS with `@babel/parser` (`cd /c/Dev/TrainWise/TrainWiseExpo`) before building.
5. **Doc-sync (mandatory):** when a feature ships, move it into `docs/featureslist.md` + `docs/features.md`
   on `main` (per the CLAUDE.md doc-sync rule) and update SETUP/DEPLOY/SECURITY if config/secrets changed.
6. **Secrets:** never commit `appsettings.json` (Azure pwd), the release keystore, `google-services.json`,
   or any API key. Run the safe-push checklist in `docs/SECURITY.md`.

## Architecture quick-reference (where things plug in)
- **Backend:** `Controllers/ → BL/ → DAL/ → DBservice` (raw ADO.NET, stored procs or inline parameterized
  SQL). POCOs in `BL/Models/`. New endpoints under `api/[controller]`. New tables/procs → a dated
  `sql/<YYYY-MM-DD>_*.sql` migration (run on **both** local SQL Express and Azure SQL).
- **Frontend:** screens in `src/screens/`, reusable in `src/components/`, HTTP in `src/services/api.js`
  (primary) / `src/api/api.js` (legacy). Navigation in `src/navigation/NavigationStack.js`. Theme via
  `useThemedStyles(makeStyles)`. Auth via `src/api/AuthContext.js`.
- **ML:** Python Flask service in `ml/` (local SQL Express, port 8000), client `src/services/mlApi.js`.
- **Build:** JS-only change → `gradlew assembleRelease` (delete the cached JS bundle first). Native/`app.json`
  change → full rebuild; **never** `expo prebuild` (wipes Health Connect manifest aliases).

**Effort legend:** 🟢 small (mostly JS) · 🟡 medium (client + backend + maybe a migration) · 🔴 large
(new subsystem / native / infra). ⭐ = high value for the grade/demo.

---

## 🔒 Security requirements (MANDATORY — read before building any feature below)

> Added 2026-07-02 after a security audit. See `tasks/security_audit_2026_07_02.md` for the full
> findings, CVSS scores, and the fixes already applied (password hashing, upload validation, rate
> limiting, error-message sanitisation, DB-secret externalisation).

**The one systemic blocker.** The API today has **no authentication and no authorization** — every
endpoint is anonymous and trusts a client-supplied `userId` in the route/body (IDOR / BOLA). Until a
real identity layer exists, ANY feature that reads or writes one user's data on behalf of "the logged-in
user" is exploitable (any caller can pass someone else's id). **Ship the token-based auth foundation
(`docs/featureslist.md` → Planned "hardened auth") before, or alongside, the features marked 🔐 below.**
Minimum viable version:
- Issue a signed **JWT** on login / google-login / signup (`Microsoft.AspNetCore.Authentication.JwtBearer`),
  containing `sub = UserID`. Store it in `expo-secure-store` on the client (NOT AsyncStorage).
- `app.UseAuthentication()` + `[Authorize]` by default; `[AllowAnonymous]` only on login/signup/forgot.
- **Ownership check on every user-scoped route:** the `UserID` in the token MUST match the `{id}` in the
  route (or the row's owner) — reject with 403 otherwise. A shared helper
  `bool OwnsResource(int routeUserId)` comparing the JWT `sub` claim.
- Send `Authorization: Bearer <jwt>` from both axios clients via a request interceptor.

**Rules that apply to EVERY feature below (baseline — no exceptions):**
1. **Parameterise all SQL** (stored procs or `SqlParameter`). Never string-concatenate/interpolate a
   value into SQL. If you must build a clause dynamically, whitelist the fragments (see
   `BoardDAL.GetLeaderboard`'s `metric` switch) — never interpolate raw input.
2. **Validate + clamp every input server-side** (ranges, lengths, enums). Client validation is UX only.
   Optional DTO fields must be `string?` (nullable-refs are ON — a plain `string` is implicitly required).
3. **File uploads → `UploadValidator.TryValidateImage`** (size cap + magic-byte sniff + server-derived
   extension). For NEW media types (audio/video) extend it with that type's magic bytes; never trust the
   client filename/Content-Type. Anything written under `wwwroot` is served publicly → treat as attacker-
   reachable (stored-XSS risk for `.html`/`.svg`).
4. **Never echo `ex.Message` to the client** on a 500 — return a generic message, log the detail server-side.
5. **No secrets in source or in the bundle.** Third-party API keys and provider secrets (Stripe, OpenAI,
   Google, SMTP, FCM) live in Azure App Service config / server-side env vars. `EXPO_PUBLIC_*` vars are
   shipped in the APK in plaintext — only public values (Maps client key) may use that prefix.
6. **Authorise writes to shared objects** (delete post, edit comment, respond to offer): confirm the caller
   owns the row (the backend already does this for `board` delete via `userId` — do the same everywhere,
   and replace the client-supplied id with the JWT `sub` once auth lands).
7. **User-generated text is untrusted.** It's fine in native `<Text>` (RN doesn't execute HTML), but any
   feature that renders in a WebView, generates HTML/PDF, or emails content MUST HTML-encode it. Add basic
   length limits + optional profanity/abuse moderation for public text (board, reviews, comments, chat).

**Per-feature security callouts (🔐 = needs the auth/ownership foundation to be safe):**

- **#110 Forgot / reset password** 🔐 — store the reset code **hashed** (same `PasswordHasher`), single-use,
  short TTL (≤15 min), invalidated on use. Constant-time compare. **Never reveal whether the email exists**
  ("if it exists, a code was sent"). Rate-limit `/auth/forgot` + `/auth/reset` (reuse the `"auth"` limiter).
  Set the new password via the hashing path (already in place). Don't log the code.
- **#111 Change password** — already built + hardened (verifies current, stores PBKDF2, rate-limited). When
  auth lands, also enforce that the `{id}` == token `sub` (today any caller who knows the current password
  can change it — acceptable only until then).
- **#112 Biometric login** — client-only gate; it must NOT become the sole credential. Store only a boolean
  flag; keep the actual session/JWT in `expo-secure-store`, gated behind `authenticateAsync()`. On biometric
  failure fall back to password — never bypass the server check.
- **#113 Delete my account (GDPR)** 🔐 — destructive + must be **self-only** (token `sub` == `{id}`). Require
  re-auth (password/biometric) immediately before. Cascade-delete or anonymise ALL related rows (ActivityLogs,
  Messages both directions, Friendships, CoachTrainees, board posts, uploads on disk) in one transaction.
- **#114 Email verification** 🔐 — same hashed-code/TTL/rate-limit rules as #110. Don't leak existence.
- **#163 Multi-device sessions** 🔐 — requires real tokens to be meaningful; store a per-session token id,
  allow revocation server-side (deny-list / rotate). Don't expose other users' device metadata.
- **#123 Export history (CSV/PDF)** 🔐 — export ONLY the caller's own data. If a filename/id is passed,
  authorise it. Guard against CSV-injection (prefix cells starting with `= + - @` with `'`). Stream, size-cap.
- **#124 Notes + photos** — photo path via `UploadValidator` (done for uploads). Note text is untrusted (rule 7).
- **#131 Weight / body-composition** 🔐 — **already built and currently IDOR-exposed**: `GET/POST
  /api/users/{id}/measurements` trusts `{id}`. Add the ownership check when auth lands (sensitive health data).
- **#132/#166 Nutrition + barcode** — Open Food Facts calls from the client are fine (no key); cache + clamp.
- **#133 Assigned programs / #134 Coach comments** 🔐 — verify the caller is actually the trainee's linked
  coach (check `CoachTrainees`) before writing to a trainee's calendar or workout. Trainee text is untrusted.
- **#135 Video form-check / #177 video analysis** 🔐 — extend `UploadValidator` for video (magic bytes: mp4
  `ftyp`, size cap ≥ image, duration/type allowlist). Scan/queue large files off the request thread. Only the
  trainee + their coach may fetch the clip (authorise the read, don't rely on an unguessable path).
- **#146 Dynamic gym search / #166** — Google Places is billable: proxy through the backend OR keep the key
  API-restricted + referrer/quota-capped; cache aggressively; rate-limit to avoid a cost-DoS.
- **#168 Coaching payments (Stripe)** 🔐 — **Stripe secret key server-side ONLY** (never in the app).
  **Verify the webhook signature** (`Stripe-Signature`) before trusting any event. Store only Stripe ids,
  never card data (PCI). Entitlement (coach features) is granted server-side from a verified subscription,
  never from a client claim. Use test keys for the demo.
- **#169 Coach marketplace + reviews** 🔐 — one review per coaching relationship (enforce server-side);
  review text untrusted (rule 7 + length cap + moderation). Authorise: only a real past trainee can review.
- **#153/#154/#155/#176 AI features** — **move the OpenAI key server-side** (today `EXPO_PUBLIC_` = shipped
  in the APK). Treat the model's output as untrusted (validate #154's generated plan before writing to the
  calendar). **Prompt-injection:** user data / notes injected into a prompt can try to steer the model —
  keep it read-only-advisory, never let AI output trigger a write without validation. Sending user health
  data to a third party is a privacy disclosure — document it + get consent. For #155 vision, the uploaded
  image goes through `UploadValidator` first.
- **#181 Workout share via deep link** 🔐 — validate the id in `trainwiseexpo://workout/{id}`; the "public
  read" endpoint must return ONLY explicitly-shared, non-sensitive fields (no owner PII, no health detail).
  Don't let a deep link trigger a state change / open-redirect. Rate-limit the public endpoint.
- **#143 Comments / #144 Feed / #145 Events / #142 Challenges / #170 friends-leaderboard / #171 kudos** 🔐 —
  respect privacy: the feed/leaderboard must only surface data the viewer is allowed to see (friends /
  opted-in / public). Text untrusted. Events expose location — show approximate, opt-in only. Authorise
  join/RSVP/challenge actions to the acting user.
- **#158 Offline mode** — the local SQLite/AsyncStorage cache is data-at-rest on the device; don't cache
  another user's data, and treat the queue as untrusted on flush (re-validate server-side).
- **#185 What-if simulator** — clamp `addSessions`/`intensity` to sane ranges server-side and debounce the
  client; an unclamped/al un-throttled slider is a DoS on the local ML service.
- **#129/#130 Sleep / HRV readiness** — new HC permissions edit the manifest (full rebuild); keep the HC
  alias rules intact (CLAUDE.md). Health data stays on-device / in the user's own row only.

---

## Auth & Accounts

### 110. Forgot / reset password  🟡 ⭐
- **Goal:** let a user reset a forgotten password (the Login screen already shows a dead "RESET PASSWORD HERE" link).
- **Frontend:** new `ForgotPasswordScreen` in `AuthStack`; wire the existing link in `LoginScreen.js`. Flow: enter email → enter emailed code → set new password.
- **Backend:** `AuthController` → `POST /auth/forgot` (create a short-lived code, hashed, with expiry), `POST /auth/reset` (verify code + set password). New `PasswordResets` table + procs.
- **DB:** `sql/<date>_add_password_resets.sql`.
- **External:** an email sender (Azure Communication Services email free tier, or any SMTP).
- **Notes:** pair with #167 (hash the new password). Never reveal whether the email exists ("if it exists, a code was sent"). Rate-limit requests.
- **Acceptance:** request → receive code → reset → log in with the new password; expired/invalid codes rejected.

### 111. Change password in Settings  🟢
- **Goal:** logged-in user changes their password.
- **Touches:** `SettingsScreen.js` (current + new + confirm fields); `UsersController` `PUT /{id}/password` → BL verifies current via `sp_LoginUser`-style check, updates. No new table.
- **Notes:** Google-only accounts (empty password) should hide this or show "set a password."
- **Acceptance:** wrong current password rejected; correct → can log in with new password.

### 112. Biometric login  🟢 ⭐
- **Goal:** unlock the app with fingerprint/face after first login.
- **Touches:** `expo-local-authentication` (`expo install`). On successful login, offer "enable biometric"; store a flag + the user blob already in AsyncStorage. On launch, if enabled, `authenticateAsync()` gates `bootstrapAsync` in `AuthContext`.
- **Notes:** purely client-side; no backend. Fallback to password on failure.
- **Acceptance:** enable → next launch prompts biometric → unlocks to the app.

### 113. Delete my account (GDPR)  🟡
- **Goal:** user permanently deletes their account + data.
- **Touches:** `SettingsScreen` danger zone with confirm; `UsersController` `DELETE /{id}` already exists — extend BL to cascade-delete (or soft-anonymize) ActivityLogs, Messages, Friendships, etc. Then `logout()`.
- **DB:** ensure FK cascade or explicit deletes in a `sp_DeleteUserCascade`.
- **Acceptance:** confirm → account + related rows gone → app returns to Welcome.

### 114. Email verification at signup  🟡
- **Goal:** verify the email is real before/after account creation.
- **Touches:** send a code on register (reuse #110's email infra + `PasswordResets`-like table or a `EmailVerifications`); gate full access (or just a "verified" badge) until confirmed.
- **Acceptance:** unverified state visible; entering the code flips `EmailVerified=1`.

### 163. Multi-device session management  🟡
- **Goal:** "log out other devices" / see active sessions.
- **Touches:** the app already persists a `deviceId`. Add a `Sessions`/`UserDevices` row per login with last-seen; `UsersController` `GET /{id}/sessions` + `DELETE /{id}/sessions/{deviceId}`. Settings lists them.
- **Notes:** without real tokens this is advisory; pairs well with Planned token-based sessions.
- **Acceptance:** list shows this device; revoking another device is reflected on next poll.

---

## Home / Load Dashboard

### 115. Monthly / yearly load history  🟡
- **Goal:** see load beyond the rolling week.
- **Touches:** new range toggle on Stats/Home; reuse `getBarColor` + the client ACWR calc (`utils/acwr.js`). Backend: a `GET /activitylog/user/{id}/range?from&to` or aggregate client-side from existing logs.
- **Acceptance:** switch week/month/year → chart re-aggregates correctly.

### 116. Reorderable / hideable dashboard tiles  🟢
- **Goal:** user customizes which Home tiles show and their order.
- **Touches:** persist a tile-order array in AsyncStorage (per-account, like the seen-coach-plans key); render Home tiles from it; an edit mode with drag (`react-native-reanimated` already present).
- **Acceptance:** hide a tile / reorder → persists across restarts.

### 117. "Today's plan" card on Home  🟢
- **Goal:** surface today's planned workout from the training calendar on Home.
- **Touches:** read planned workouts (CalendarController) for today; render a card under `SmartSuggestionCard`; tap → AddWorkout prefilled / calendar.
- **Acceptance:** a planned workout for today appears on Home with a complete action.

### 118. Week-over-week delta indicators  🟢
- **Goal:** ▲/▼ vs last week on the load + AC tiles.
- **Touches:** compute prior-week acute from existing logs; show delta % on the tiles in `HomeScreen`/`HomeHeader`.
- **Acceptance:** deltas match a hand check against two weeks of data.

### 180. Goal setting & tracking  🟡 ⭐
- **Goal:** user sets a target (weekly load / distance / weight) and tracks progress.
- **Touches:** `Goals` table (type, target, period, startDate) + `UserGoalsController` already exists for training goals — extend or add `PersonalGoals`. Home progress ring + Settings to set. 
- **Acceptance:** set a weekly-load goal → progress ring fills as workouts are logged; completion celebrated (#173).

---

## Workouts & Activity

### 119. Workout templates / favorites  🟡 ⭐
- **Goal:** save a workout as a reusable template and start from it.
- **Touches:** `WorkoutTemplates` table (userId, name, activityType, default duration/target) + controller; AddWorkout gets a "Start from template" picker + "Save as template."
- **Acceptance:** save a template → it appears in the picker → prefilling AddWorkout.

### 120. Interval / rest timer  🟢
- **Goal:** built-in timer for rest/intervals with sound + haptics.
- **Touches:** new `TimerScreen`/modal; `expo-haptics` (present) + `expo-av` or `expo-audio` for the beep; configurable work/rest/rounds. No backend.
- **Acceptance:** start a 30s/15s × 5 timer → audible + haptic transitions; runs in foreground.

### 121. Live GPS run tracking  🔴 ⭐  ✅ BUILT 2026-07-21
> `LiveRunScreen` (expo-location foreground `watchPositionAsync`, live polyline on expo-maps,
> live time/distance/pace, start/pause/resume/finish + effort review). On save → `createActivityLog`
> (+ `calculateDailyLoad` ×2) and the route polyline persists to AsyncStorage (`@trainwise_route_<startISO>`);
> `WorkoutRouteScreen` now accepts a `routePoints` param (immediate view) and reads that AsyncStorage key
> before the HC fallback. Entry: "Track a run with GPS" on the Health tab. JS-only (no prebuild; expo-location/
> expo-maps already native). Limitation: route is on-device only (not synced/coach-visible) — deliberate scope.
- **Goal:** record your own outdoor route (not only HC imports).
- **Touches:** `expo-location` (present) background/foreground tracking; draw the polyline on `expo-maps`; on stop, compute distance/duration → POST an ActivityLog + save the route. Reuse `WorkoutRouteScreen` for display.
- **Notes:** foreground-only is fine for a demo (background location needs extra perms). Big effort: tracking lifecycle, pause/resume, battery.
- **Acceptance:** start → walk → stop → a workout with a visible route map is saved.

### 122. Heart-rate zone breakdown  🟡
- **Goal:** show time-in-zone from HC heart-rate data.
- **Touches:** read HR samples in `HealthConnectService`; compute zones from max-HR (220−age, `birthYear`); render a zone bar on WorkoutSummary.
- **Acceptance:** an HC workout with HR shows a 5-zone distribution.

### 123. Export workout history (CSV / PDF)  🟡
- **Goal:** export logs to share/backup.
- **Touches:** client builds CSV from logs + `expo-sharing`/`expo-file-system`; or a backend `GET /activitylog/user/{id}/export` returning a file. PDF via the existing Python/`generate_docs_pdf.py` pattern or a JS lib.
- **Acceptance:** export → a valid CSV/PDF with the user's workouts is shareable.

### 124. Per-workout notes + photos  🟢
- **Goal:** attach a note/photo to a workout.
- **Touches:** add `Notes`/`PhotoPath` columns to ActivityLogs (migration) + upload reuse (`uploadChatImage` pattern → `wwwroot/images`); show on WorkoutSummary/AddWorkout.
- **Acceptance:** add a note+photo → persists and displays on the summary.

### 164. Exercise library / catalog  🟡
- **Goal:** a browsable catalog of exercises (name, muscle group, instructions, image/GIF).
- **Touches:** `Exercises` reference table (seed it) + controller; a `ExerciseLibraryScreen` with search/filter by muscle group; link from AddWorkout.
- **Acceptance:** browse/search exercises; open one to see instructions.

### 165. Per-activity personal-best dashboard  🟡
- **Goal:** best efforts per activity (fastest 5k, longest ride, most reps).
- **Touches:** extend the existing PersonalRecords logic (`RecordsBL`) to compute per-activity bests; a `PersonalRecordsScreen` section grouped by activity.
- **Acceptance:** logging a new best updates the dashboard and fires the PR detection.

### 181. Workout share via deep link  🟡
- **Goal:** share a workout; opening the link opens it in-app.
- **Touches:** the app scheme is `trainwiseexpo://`; add `expo-linking` routes (`trainwiseexpo://workout/{id}`); a public read endpoint for shared workouts; `expo-sharing` to send the link.
- **Acceptance:** share → tapping the link opens the workout screen.

---

## Injuries

### 125. Body-map injury picker  🟡 ⭐
- **Goal:** tap a body diagram to set injury location instead of a dropdown.
- **Touches:** an SVG front/back body map component; map regions → `InjuryTypeID`/a new `BodyRegion` column; integrate into `InjuryReportScreen`.
- **Acceptance:** tapping "left knee" preselects the matching injury type/region.

### 126. Rehab / recovery suggestions per injury  🟡
- **Goal:** show recovery exercises for the reported injury type.
- **Touches:** a `RecoveryExercises` reference table keyed by `InjuryTypeID` (seed) + controller; render on `ActiveInjuriesScreen`. Optionally reuse the OpenAI advice path.
- **Acceptance:** an active "shin splints" injury shows relevant rehab tips.

### 127. Daily pain-level tracking  🟢
- **Goal:** log pain 1–10 per day during recovery to chart the trend.
- **Touches:** `InjuryPainLog` table (injuryId, date, level); a quick logger on ActiveInjuries; a small trend line.
- **Acceptance:** log a few days → a descending/ascending trend renders.

### 128. Re-injury risk flag (ACWR-linked)  🟡
- **Goal:** warn when load spikes while an injury is active/recent.
- **Touches:** combine active-injury state with the client ACWR (`utils/acwr.js`); show a banner on Home/Warnings when AC>1.3 and a recent injury exists.
- **Acceptance:** with a recent injury + high AC ratio, the warning appears.

---

## Health & Wearables

### 129. Sleep sync → readiness score  🟡 ⭐
- **Goal:** import HC sleep sessions and compute a daily readiness/recovery score.
- **Touches:** add the HC sleep permission + read in `HealthConnectService` (manifest + `app.json` — native rebuild); a readiness formula (sleep + ACWR + resting HR); show on Home.
- **Notes:** adding a health permission edits the manifest → full rebuild; keep the HC alias rules intact.
- **Acceptance:** with sleep data, a readiness score shows and reacts to poor sleep.

### 130. Resting HR / HRV readiness  🟡
- **Goal:** factor resting HR / HRV into readiness.
- **Touches:** HC read (HR/HRV permissions); blend into #129's score.
- **Acceptance:** elevated resting HR lowers the readiness score.

### 131. Weight & body-composition tracking  🟢
- **Goal:** log weight over time + chart.
- **Touches:** `BodyMeasurements` table (date, weight, bodyFat?) + controller; a logger + trend chart on Profile. (HC weight import optional.)
- **Acceptance:** log weights → a trend line renders; latest weight updates Profile.

### 132. Hydration & nutrition logging  🟡
- **Goal:** log water + meals/calories.
- **Touches:** `NutritionLog` table (date, type, calories, water) + controller; a daily logger + summary. Feeds #167.
- **Acceptance:** log water/meals → daily totals shown.

### 166. Barcode food scanner  🟡
- **Goal:** scan a product barcode to log nutrition.
- **Touches:** `expo-camera` `scanFromURLAsync`/barcode scanning (camera already used for QR); query a free food DB (Open Food Facts API); prefill #132.
- **Acceptance:** scan a barcode → product + calories prefilled into the nutrition log.

### 167. Daily calorie-balance ring  🟢
- **Goal:** intake (from #132) vs burned (from workouts/HC) as a ring.
- **Touches:** compute balance client-side; ring on Home.
- **Acceptance:** logging food/workouts moves the ring.

### 182. Watch / Wear OS companion  🔴
- **Goal:** glanceable load/streak on a smartwatch.
- **Touches:** large — a Wear OS module or a complication; out of scope for pure-Expo without native modules. Document as stretch.
- **Acceptance:** watch face shows today's load (stretch goal).

---

## Coach ↔ Trainee

### 133. Assigned training programs  🔴 ⭐  ✅ BUILT 2026-07-21
> Scope chosen: **per-program thread** (coach → ONE trainee). SQL `2026-07-21_add_programs.sql`
> (`TrainingPrograms`/`ProgramWorkouts`/`ProgramAssignments` + `PlannedWorkouts.SourceAssignmentId` +
> `ProgramMessages`/`Reactions`/`Reads`). C# `ProgramsController`/`ProgramBL`/`ProgramDAL`/`ProgramModels`
> (inline parameterized SQL). **Assigning fans the template onto the trainee's existing calendar**
> (`PlannedWorkouts`, tagged with `SourceAssignmentId` for a clean unassign). Per-assignment chat reuses
> the group-chat UI: `EventChatScreen` is now **channel-aware** (`route.params.kind` 'event'|'program',
> back-compatible). Screens: `ProgramBuilderScreen`, `CoachProgramsScreen` (manage + pick-to-assign),
> `MyProgramsScreen`, `ProgramDetailScreen`, + `ProgramChat` route. Entry: coach → CoachTraineeDetail
> "Assign a program"; trainee → TrainingCalendar "My training programs".
- **Goal:** a coach builds a multi-week program and assigns it to a trainee.
- **Touches:** `Programs` + `ProgramWorkouts` + `ProgramAssignments` tables + controller; coach builder screen; trainee sees the plan on the calendar (#117 ties in).
- **Acceptance:** coach assigns a 4-week plan → it populates the trainee's calendar.

### 134. Coach comments on a workout  🟡
- **Goal:** a coach leaves feedback on a specific trainee workout.
- **Touches:** `WorkoutComments` table (logId, coachId, text) + controller; show on the trainee's WorkoutSummary + coach drill-down; notify the trainee.
- **Acceptance:** coach comments → trainee sees it + gets a push.

### 135. Video form-check  🟡
- **Goal:** trainee uploads a form video; coach reviews + replies.
- **Touches:** video upload (extend the multipart upload to video; size limits) + a review thread (reuse chat). 
- **Acceptance:** upload a clip → coach views + responds.

### 136. Squad / team coaching  🔴
- **Goal:** group trainees into a squad under one coach.
- **Touches:** `Squads` + membership tables; coach squad view with aggregate load; group chat (#147).
- **Acceptance:** create a squad, add trainees, see combined stats.

### 137. Trainee progress report (PDF)  🟡
- **Goal:** auto-generate a PDF progress report for a trainee.
- **Touches:** reuse the Python PDF generator pattern or a JS PDF lib; pull PMC/ACWR/forecast; share/email.
- **Acceptance:** generate → a PDF with charts + summary is produced.

### 168. In-app coaching payments / subscriptions  🔴
- **Goal:** monetize coaching (one-off or subscription).
- **Touches:** Stripe (test mode) — `expo` + Stripe SDK or a checkout WebView; backend webhook + `Subscriptions` table; gate coach features on active sub.
- **Notes:** keep Stripe secret server-side only. Big compliance surface — demo with test keys.
- **Acceptance:** test-card checkout → subscription active → coach features unlocked.

### 169. Coach marketplace + ratings/reviews  🟡 ⭐
- **Goal:** discover coaches with ratings & reviews.
- **Touches:** `CoachReviews` table (rating, text) + controller; a `CoachMarketplaceScreen` (search/sort by rating, specialty); review after a coaching relationship.
- **Acceptance:** browse coaches sorted by rating; leave a review that updates the average.

---

## Chat & Messaging

### 138. Typing indicator + online status  🟢
- **Goal:** show "typing…" and the peer's online dot in chat.
- **Touches:** reuse the presence heartbeat (`SocialContext`) for online; typing via a short-lived flag (a `PUT /messages/typing` ping or a lightweight poll field). Mind the vCore cost — keep it cheap/foreground-only.
- **Acceptance:** peer typing shows the indicator; online dot reflects presence.

### 139. Voice messages  🟡
- **Goal:** record + send audio messages.
- **Touches:** `expo-av`/`expo-audio` record → upload (extend chat upload to audio) → bubble with a play control. New `AudioPath` on Messages.
- **Acceptance:** record → send → peer plays it.

### 140. Message reactions (emoji)  🟢
- **Goal:** react to a message with an emoji.
- **Touches:** `MessageReactions` table (messageId, userId, emoji) + endpoints; long-press a bubble to react.
- **Acceptance:** react → both sides see the reaction.

### 141. True closed-app push  🟡 ⭐
- **Goal:** receive message/social pushes when the app is fully closed.
- **Touches:** FCM is already wired (`PushSender`, device tokens). Send **data/notification messages** from the backend on new message/friend event instead of relying on the in-app poller. Handle background notification taps → deep link.
- **Notes:** this also reduces Azure burn (no polling needed for notifications). Test on a real device with the app killed.
- **Acceptance:** kill the app → receive a message → a system notification appears.

---

## Connect / Social

### 142. Friend challenges  🟡 ⭐
- **Goal:** challenge a friend (most load/most workouts/longest streak this week).
- **Touches:** `Challenges` + `ChallengeParticipants` tables + controller; a challenge screen with live standings; notify on create/win.
- **Acceptance:** create a challenge → both progress tracked → winner declared at period end.

### 143. Comments on workout-board posts  🟡
- **Goal:** comment on board posts (only likes exist today).
- **Touches:** `WorkoutPostComments` table + endpoints; a comments sheet on `WorkoutBoardScreen`.
- **Acceptance:** comment → appears under the post with author + time.

### 144. Activity feed / follow  🟡
- **Goal:** a feed of friends' recent activity (workouts, PRs, posts).
- **Touches:** aggregate friends' public events into a `GET /social/feed/{userId}`; a feed screen. (Friendship already exists; "follow" can reuse it.)
- **Acceptance:** a friend logs a workout → it appears in your feed.

### 145. Group runs / events  🟡
- **Goal:** create an event (time, place, gym) and RSVP.
- **Touches:** `Events` + `EventRSVPs` tables + controller; an events list/detail with the gym map pin reuse; notify RSVPs.
- **Acceptance:** create an event → friends RSVP → it shows on the map/list.

### 146. Dynamic gym search anywhere  🟡
- **Goal:** find gyms by the user's current location, not just seeded Netanya gyms.
- **Touches:** call Google Places (key already configured, API-restricted) for nearby gyms; merge with seeded ones; cache.
- **Notes:** Places is a billable SKU — keep within free tier; cache results.
- **Acceptance:** in a new city, nearby gyms appear on the Connect map.

### 170. Private friends-only leaderboard  🟢
- **Goal:** a leaderboard scoped to your friends.
- **Touches:** filter the existing `Leaderboard` query by the friend set; a toggle (Global / Friends).
- **Acceptance:** toggle Friends → only friends ranked.

### 171. Kudos / cheers on workouts  🟢
- **Goal:** Strava-style kudos on a friend's completed workout.
- **Touches:** reuse the likes pattern (`WorkoutPostLikes`) for workout/feed items; a kudos button + count; notify.
- **Acceptance:** give kudos → friend sees the count + a push.

---

## Gamification

### 147. Tiered achievements + unlock animation  🟢 ⭐
- **Goal:** structured achievements (bronze/silver/gold) with a celebratory unlock.
- **Touches:** extend `badges.js`/RecordsBL with tiers + thresholds; a `react-native-reanimated` unlock animation; an Achievements screen.
- **Acceptance:** crossing a threshold unlocks the tier with an animation.

### 148. Daily / weekly quests  🟡
- **Goal:** rotating quests ("log 3 workouts this week") with coin rewards.
- **Touches:** `Quests` + `UserQuestProgress` tables + controller (or generate client-side from stats); a quests card; award coins on completion.
- **Acceptance:** complete a quest → reward granted + UI updates.

### 149. Seasonal divisions  🟡
- **Goal:** bronze→diamond divisions with weekly promotion/relegation on the leaderboard.
- **Touches:** a `Division` field + a weekly job (or on-read compute) that promotes/relegates by rank.
- **Acceptance:** top performers promote; bottom relegate at week reset.

### 150. Streak freeze / repair  🟢
- **Goal:** Duolingo-style streak protection (buy with coins).
- **Touches:** streak logic already exists; add a freeze item to the shop + a "repair yesterday" action that spends coins.
- **Acceptance:** missing a day with a freeze keeps the streak.

### 172. Shareable achievement cards  🟡 ⭐
- **Goal:** export a nice image of a PR/achievement to share.
- **Touches:** render a card off-screen → `react-native-view-shot` → `expo-sharing`. 
- **Acceptance:** tap share on a PR → a branded image is shareable to other apps.

### 173. Milestone celebrations (confetti)  🟢
- **Goal:** celebrate big milestones (100 km, 50 workouts) with confetti.
- **Touches:** detect milestones from cumulative stats; a confetti animation (`react-native-reanimated`); reuse for goal completion (#180).
- **Acceptance:** hitting a milestone triggers the celebration once.

---

## Smart Workout & AI

### 151. "Best time to train today"  🟢
- **Goal:** recommend the best hour today from weather + calendar.
- **Touches:** the Weather API already returns hourly-ish data; score hours with `smartWorkout.js`; show the best window on the smart card.
- **Acceptance:** the card suggests a concrete time window.

### 152. Indoor alternative when weather is poor  🟢
- **Goal:** when conditions are Poor, suggest an indoor activity.
- **Touches:** extend `smartWorkout.js` to branch to indoor activity chips when the conditions score is low.
- **Acceptance:** in bad weather, indoor options are recommended.

### 153. AI "your week in review"  🟡 ⭐
- **Goal:** a weekly AI-written summary of training + a tip.
- **Touches:** build a prompt from the week's logs/ACWR → `openai.js`; render on Home weekly; cache per week.
- **Acceptance:** a coherent, data-grounded weekly summary appears.

### 154. AI workout-plan generator  🟡 ⭐
- **Goal:** generate a weekly plan from the user's goal + level + history.
- **Touches:** prompt OpenAI with goal/level/recent load → parse into calendar entries (#117/#133). Validate output before writing.
- **Acceptance:** generate → a sensible week populates the calendar.

### 155. Vision-based injury photo analysis  🟡
- **Goal:** analyze the injury photo (not just text) with a vision model.
- **Touches:** swap the text-only OpenAI call in InjuryReport for a vision call with the uploaded image.
- **Notes:** keep the key server-side ideally; today it's `EXPO_PUBLIC_` (demo only).
- **Acceptance:** a photo yields image-aware advice.

### 176. AI "ask my data" assistant  🟡 ⭐
- **Goal:** chat that can answer questions about *your* data ("how was my week?", "am I overtraining?").
- **Touches:** a lightweight RAG — fetch the user's recent logs/ACWR and inject as context into `AIChatScreen`'s prompt.
- **Acceptance:** ask "how many workouts last week?" → correct, grounded answer.

### 177. AI video form analysis  🔴
- **Goal:** analyze exercise form from a video (pose estimation).
- **Touches:** large — a pose model (MediaPipe / a cloud vision API) on the uploaded clip (#135); feedback overlay. Likely a new ML endpoint.
- **Acceptance:** upload a squat clip → basic form feedback (stretch goal).

---

## Notifications

### 161. Notification preferences + quiet hours  🟢
- **Goal:** per-type toggles + a do-not-disturb window.
- **Touches:** persist prefs (AsyncStorage or a `NotificationPrefs` table); `NotificationService` + `PushSender` honor them.
- **Acceptance:** disabling a type / setting quiet hours suppresses those notifications.

### 162. Weekly recap notification  🟢
- **Goal:** a Sunday recap push (workouts, load, streak).
- **Touches:** schedule a weekly local notification (the daily-reminder pattern in `NotificationService`).
- **Acceptance:** a recap fires weekly with real numbers.

---

## Theme & UX / Accessibility / Platform

### 156. Localization (EN / HE / FR) + RTL  🟡 ⭐
- **Goal:** translate the UI; support Hebrew RTL.
- **Touches:** an i18n lib (`i18n-js` / `expo-localization`); extract strings; `I18nManager` for RTL; a language picker in Settings.
- **Notes:** big string-extraction effort; RTL needs layout review. High value for an Israeli audience.
- **Acceptance:** switch to Hebrew → UI translates and mirrors correctly.

### 157. Accessibility pass  🟡
- **Goal:** font scaling, screen-reader labels, sufficient contrast.
- **Touches:** add `accessibilityLabel`/roles to interactive elements; respect OS font scale; audit color contrast in `palettes.js`.
- **Acceptance:** TalkBack reads key controls; large-font mode doesn't break layouts.

### 158. Offline mode + sync queue  🔴
- **Goal:** use core features offline; sync when back online.
- **Touches:** local cache (AsyncStorage/SQLite) + a write queue that flushes on reconnect (`@react-native-community/netinfo`). Big consistency surface.
- **Acceptance:** log a workout offline → it syncs when connectivity returns.

### 159. Android home-screen widget  🔴
- **Goal:** a glanceable widget (today's load / streak).
- **Touches:** native Android widget (`react-native-android-widget` or a config plugin) — careful, no `expo prebuild`. 
- **Acceptance:** widget shows current load and updates daily (stretch).

### 160. Multiple accent themes / color picker  🟢
- **Goal:** let users pick an accent beyond light/dark.
- **Touches:** the theme system (`palettes.js` + `applyTheme`) already swaps palettes — add more palettes + a picker in Settings.
- **Acceptance:** pick an accent → applies app-wide and persists.

### 174. Trainee self-analytics  🟡 ⭐
- **Goal:** give trainees their own PMC/ACWR charts (today coach-only).
- **Touches:** reuse `CoachTraineeAnalyticsScreen` charts + `mlApi.js` for the logged-in user; add to Profile/Stats.
- **Notes:** the ML service is local-LAN only — degrade gracefully when offline (it already does).
- **Acceptance:** a trainee sees their own PMC + ACWR safe-zone charts.

### 178. In-app "What's New" changelog  🟢
- **Goal:** show a changelog modal after an update.
- **Touches:** bundle a versioned changelog; compare stored vs current app version on launch; show once.
- **Acceptance:** after a version bump, the modal shows once.

### 179. Scheduled theme (auto dark at sunset)  🟢
- **Touches:** use `expo-location`/a sunset calc or a fixed schedule to flip `setTheme` automatically.
- **Acceptance:** theme switches to dark in the evening automatically.

---

## Analytics & Injury-Intelligence (curated — closest to TrainWise's core)

> These expand the coach ML/forecast **and** bring analytics to the trainee side. They're kept because
> they're on-brand for TrainWise's reason to exist (training-load + injury prevention), reuse the existing
> Python service + load data (little new infra), and each presents as one simple gauge / badge / chart any
> user reads instantly. **Foundation:** ship **#174 (Trainee self-analytics)** first — it stands up the
> trainee analytics page by reusing `CoachTraineeAnalyticsScreen` + `mlApi.js`. Narrative layer: **#153 /
> #176** (AI "week in review" / "ask my data"). The three below are the new core metrics.

### 183. Injury-Risk Gauge — Monotony & Strain  🟡 ⭐⭐ — coach + trainee
- **Goal:** one **0–100 risk gauge** (green / amber / red) that fuses **ACWR** with **training monotony**
  (weekly mean daily load ÷ its standard deviation) and **strain** (weekly load × monotony) — Foster's
  classic injury/illness predictor. The app's mission expressed as a single number anyone understands.
- **Backend/ML:** add monotony/strain to `ml/features.py` over the last 7 days; expose via a new
  `GET /api/ml/trainee/<id>/risk` in `ml/app.py` (or extend `/acwr`). Map to a 0–100 score + band with a
  **transparent rule** (e.g. monotony > 2 **and** ACWR > 1.3 → red). Mirror the C# load formula so numbers
  agree with the rest of the app.
- **Frontend:** a `RiskGauge` SVG component (reuse `react-native-svg`, as the PMC/ACWR charts do); render on
  `CoachTraineeAnalyticsScreen` and the trainee analytics page (#174), with a one-line tip
  ("Your training is very repetitive — vary intensity or add a rest day").
- **DB:** none (computed from `ActivityLogs`).
- **Notes:** thresholds from sports-science norms (monotony > 2 risky; ACWR > 1.3 risky). Degrade gracefully
  with < 7 days of data ("not enough data yet"). ML service is local-LAN — keep the offline fallback the
  analytics screen already has.
- **Acceptance:** a week of identical daily loads → high monotony → amber/red + the right tip; varied
  training with a safe ACWR → green.

### 184. Form / Freshness daily badge (readiness)  🟡 ⭐ — trainee-side (+ coach)
- **Goal:** turn the PMC **Form** value (Fitness − Fatigue, i.e. TSB) into a daily **Fresh / Neutral /
  Fatigued** badge on Home, so a trainee instantly knows whether to push or recover (Whoop "recovery" /
  Garmin "Body Battery" in spirit).
- **Backend/ML:** the `/pmc` endpoint already returns Fitness (CTL) + Fatigue (ATL); compute Form = CTL − ATL
  and map to 3 bands. Reuse `/pmc` or add a tiny `/readiness`.
- **Frontend:** a compact badge on `HomeScreen` (+ a detail row on the analytics page) with a plain message
  ("You're fresh — good day for a hard session" / "Fatigued — keep it easy today").
- **DB:** none.
- **Notes:** starting thresholds — Form > +5 fresh, −10…+5 neutral, < −10 fatigued (tune with real data).
  Offline-degraded like the rest of the ML screen.
- **Acceptance:** after a heavy block the badge reads Fatigued; after a taper it reads Fresh.

### 185. What-if forecast simulator  🔴 ⭐ — coach + trainee  ✅ BUILT 2026-07-21
> `forecast.simulate_whatif` + `GET /api/ml/trainee/<id>/whatif?addSessions=&intensity=` inject N sessions
> (easy/medium/hard = 150/300/450 load) onto today and recompute acute/chronic/ACWR via the SAME
> `rolling_loads`, returning `{baseline, simulated}` (clamped server-side). UI = a debounced (350ms)
> segmented-intensity + slider card on `CoachTraineeAnalyticsScreen` (serves coach AND trainee via #174
> `self`), showing Now → simulated AC + risk pills. Verified vs local DB (add 3 hard: 1.06→1.93, Warning→High).
- **Goal:** make the monthly forecast **interactive** — a slider for "add **N** sessions at **easy / medium /
  hard** this week" recomputes the projected **ACWR + risk** live, so coach/trainee can plan load safely
  ("can I add a long run Saturday without going red?"). Turns a static chart into a planning tool.
- **Backend/ML:** extend `ml/forecast.py` to accept hypothetical added load
  (`GET /forecast?addSessions=&intensity=`), re-running the **same** day-by-day projection (which already
  recomputes chronic load) with the injected sessions so simulated and real numbers stay consistent.
- **Frontend:** intensity/count sliders + a live-updating projection chart on the analytics screen;
  **debounce** the calls so dragging doesn't hammer the local ML service.
- **DB:** none.
- **Notes:** clamp inputs to sane ranges; reuse the existing projection + the #183 gauge so the risk reacts
  in real time. Great demo feature.
- **Acceptance:** dragging "add 3 hard sessions" pushes the projected ACWR into the red and the risk gauge
  reacts live; clearing it returns to the real forecast.

---

## See also (already in `docs/featureslist.md` → Planned)
These are tracked there, not re-specced here: CI/CD · secret scanning · static analysis · cloud ML
(deploy `ml/` to Azure) · iOS app · hardened auth (#167 password hashing, rate limiting, tokens) ·
content moderation · web/PWA · persistent AI chat history.

---

### Index by effort (quick wins first)
- 🟢 **Small:** 111, 112, 116, 117, 118, 120, 124, 127, 128, 131, 138, 140, 147, 150, 151, 152, 160, 161, 162, 167, 170, 171, 173, 178, 179
- 🟡 **Medium:** 110, 113, 114, 115, 119, 122, 123, 125, 126, 129, 130, 132, 134, 135, 137, 139, 141, 142, 143, 144, 145, 146, 148, 149, 153, 154, 155, 156, 157, 163, 164, 165, 166, 169, 172, 174, 176, 180, 181, 183, 184
- 🔴 **Large:** 121, 133, 136, 158, 159, 168, 177, 182, 185

### Analytics expansion (recommended build order)
**#174** (trainee analytics page — foundation) → **#183** (Injury-Risk Gauge — the signature metric) →
**#184** (Form/Freshness daily badge) → **#185** (What-if simulator — demo wow-factor).
Narrative layer when ready: **#153 / #176** (AI insights over the same data).
