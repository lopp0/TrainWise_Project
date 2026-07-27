# TrainWise — Session Resume, 2026-07-17 → 2026-07-20

Complete record of the "finish the remaining 🟡 medium features" arc, the five
rounds of device-testing that followed, and the final feature (#174) that closed
out the backlog. Every change is listed: the headline features, the small
refinements, and the side-effects on unrelated parts of the app.

**Status: the 🟡 medium backlog is now FULLY BUILT — every item in
`tasks/feature_backlog.md` marked 🟢/🟡 is shipped. Only 🔴 (hard, large-scope)
items remain open, see §13. All work JS validated (`@babel/parser`), C# builds
with 0 errors, release APK rebuilt and verified after every round.**

---

## 0. Table of contents

| Phase | What |
|---|---|
| [1](#1-remaining-medium-features) | Remaining 🟡 medium features (the original ask) |
| [2](#2-email--password-validation-hardening) | Email + password validation hardening |
| [3](#3-device-test-round-1--20-items) | Device-test round 1 (20 items) |
| [4](#4-device-test-round-2--drops--badges) | Device-test round 2 (drops + badges) |
| [5](#5-device-test-round-3--11-items) | Device-test round 3 (11 items) |
| [6](#6-device-test-round-4--13-items) | Device-test round 4 (13 items) |
| [7](#7-device-test-round-5--4-items) | Device-test round 5 (4 items) |
| [8](#8-load-trend-correction--174-trainee-self-analytics-the-last-medium-feature) | Load Trend correction + #174 trainee self-analytics (the LAST medium feature) |
| [9](#9-follow-up-fixes-after-174) | Follow-up fixes after #174 (forecast, Profile cleanup) |
| [10](#10-deployment-checklist) | Deployment checklist |
| [11](#11-migration-run-order) | Migration run order |
| [12](#12-dormantunused-code-left-behind) | Dormant / unused code left behind |
| [13](#13-lessons-recorded) | Lessons recorded |
| [14](#14-known-gaps--not-done) | Known gaps / not done |

---

## 1. Remaining medium features

The original request: *"continue all of the resting medium point from
`tasks/feature_backlog.md`"*. Delivered in four batches plus a deferred trio.

### 1a. Community batch
SQL: `sql/2026-07-17_add_community_batch.sql`
Tables: `Challenges`, `ChallengeParticipants`, `Events`, `EventRSVPs`, `CoachReviews`

| # | Feature | Where |
|---|---|---|
| #142 | Friend challenges (load / workouts / distance, live standings) | `src/screens/ChallengesScreen.js` |
| #144 | Activity feed | `src/screens/FeedScreen.js` — **later dropped**, see §4 |
| #145 | Group events + RSVP | `src/screens/EventsScreen.js` |
| #149 | Event attendee list | folded into EventsScreen |
| #169 | Coach marketplace + ratings/reviews | `src/screens/CoachMarketplaceScreen.js` |

Backend: `Controllers/CommunityController.cs`, `BL/CommunityBL.cs`,
`DAL/CommunityDAL.cs`, `Models/CommunityModels.cs`.

### 1b. Auth / UX / push batch
SQL: `sql/2026-07-17_add_auth_batch.sql` — table `AuthCodes`

| # | Feature | Notes |
|---|---|---|
| #110 | Forgot / reset password | `ForgotPasswordScreen.js`, `BL/AuthRecoveryBL.cs`. 6-digit code, PBKDF2-hashed, single-use, 15-min TTL. Never reveals whether an email exists. |
| #114 | Email verification | 60-min TTL code, flips `Users.EmailVerified` |
| #141 | UX polish | — |
| #157 | Push improvements | — |
| #163 | Multi-device sessions | Settings card — **rebuilt for real in §7** |
| #112 | Biometric unlock | `utils/biometric.js` |
| #111 | Change password | Settings |

`AUTH_DEV_CODES=true` echoes the generated code back in the API response so the
flows are testable without an email provider.

### 1c. AI batch
#153 AI weekly recap (`WeekReviewCard`), #154, #155, #176.

### 1d. Coach comments + shares
- #134 coach comments on a workout — SQL `2026-07-17_add_coach_comments_and_cascade.sql`,
  table `WorkoutComments`. **Later dropped**, see §4.
- #137 / #172 share flows.
- #165 `sp_GetActivityBests` server endpoint (client still uses the local
  `computePersonalBests`, so this is a dormant bonus).

### 1e. i18n foundation
#156 — dependency-free i18n singleton (`src/i18n/i18n.js` + `translations.js`),
`useLanguage()` hook, `t()`, Hebrew RTL via `I18nManager.forceRTL`.
**Later removed from the UI**, see §6.

---

## 2. Email + password validation hardening

Requested mid-way: *"the app can only get real email addresses… password
conditions… option to see the password with the eye icon."*

**New files**
- `src/utils/validation.js` — `isValidEmail` (strict regex + TLD check),
  `PASSWORD_RULES` (≥8 chars, uppercase, lowercase, number), `passwordChecks`,
  `isValidPassword`
- `src/components/PasswordInput.js` — TextInput + eye toggle
- `src/components/PasswordRequirements.js` — live checklist
- `TrainWise/TrainWise/BL/InputValidator.cs` — server-side mirror

**Applied to** SignUp, Login, ForgotPassword, Settings → Change password.

**Refinement (round 1, item 20):** the red "invalid email" hint fired while
typing. Gated behind an `emailTouched` state so it only appears on blur.

---

## 3. Device-test round 1 — 20 items

Highlights (the rest were confirmations / explanations):

| Item | Result |
|---|---|
| 1 | **#144 activity feed dropped** — too similar to the workout board |
| 2 | **Challenges reworked**: invitations require acceptance (no auto-join), coaches can't be invited (trainee-only), standings show profile picture + badges + frames via `UserProfileCard` |
| 3 | **#145 group event chat built** (see §5 #2 and §6 #7) |
| 5 | **#169 coach review** — added `KeyboardAvoidingView` so the review input isn't covered; merged into the map coach filter |
| 7/8/19 | **Settings crash** — see §5 #8 for the root cause |
| 13/14 | Dev codes — `AUTH_DEV_CODES=true` |
| 17 | **#137 report mojibake fixed**: `·` → `&middot;`, `–` → `&ndash;` |
| 20 | Email hint gated on blur |

**SQL fix**: `sql/2026-07-19_fix_challenges.sql` — adds
`ChallengeParticipants.Status` (`invited` / `joined`), rewrites
`sp_CreateChallenge`, `sp_GetChallengeStandings` (joined-only + cosmetics),
`sp_GetFriends` (+`IsTrainee`/`IsCoach`), and adds `sp_GetChallengeInvites` /
`sp_RespondChallengeInvite`.

> **SQL lesson learned here:** those two NEW procs first used `CREATE OR ALTER`
> and failed with *Msg 208 State 6*. On some server builds `CREATE OR ALTER`
> resolves to a plain `ALTER` for a not-yet-existing object. New objects must use
> `IF OBJECT_ID(...) IS NOT NULL DROP PROCEDURE` + `GO` + `CREATE PROCEDURE`.

Also fixed in this round: `sp_DeleteUser` referenced wrong columns —
`WorkoutKudos.FromUserID` (not `UserID`), `MonthlyForecasts.TraineeUserID`,
`InjuryPainLog` (no user column, cascades from `InjuriesReports`), and
`PlannedWorkouts` (not `TrainingCalendar`).

---

## 4. Device-test round 2 — drops + badges

- **#134 coach comments dropped** — `WorkoutComments` unmounted everywhere.
- **Challenge invite badges**: `SocialContext` now polls `getChallengeInvites`,
  exposes `challengeInviteCount`, and includes it in `pendingTotal`. Red badge on
  the Connect tab + on the Challenges chip.
- **5b coach rating on the map sheet**: `ConnectScreen` `UserSheet` shows a star
  summary and a "Reviews & rate" row that opens `CoachMarketplaceScreen` with
  `openCoachId` (auto-opens the reviews modal).
- Confirmed `BACKEND_MODE = 'local'` in `src/config/backend.js` — the dev-code
  issue was a stale backend, not an Azure problem.

---

## 5. Device-test round 3 — 11 items

### #8 Settings crash — ROOT CAUSE (open for 3 rounds)
`SettingsScreen.js`'s new Language / Email-verification / Devices style blocks
referenced `C.border`, `C.textPrimary`, … but **that file's factory is
`const makeStyles = (Colors) => …`** — there is no `C` in scope.
`C.*` threw `ReferenceError` synchronously inside `useThemedStyles(makeStyles)`
during render → crash on mount, before any JSX.

That is also why it produced **no error message** and why the per-card
`<ErrorBoundary>` children never caught it: the throw is in the *parent's own
body*, not in a descendant. Fixed every `C.` → `Colors.`.
An `ErrorBoundary` was additionally placed at the **navigator** level
(`SettingsWithBoundary` in `NavigationStack.js`) so future body/hook throws are
caught rather than crashing the app.

### #1 Event create "[object Object]"
`CreateEventRequest.Description` / `.LocationName` (plus
`CreateChallengeRequest.InviteeCsv`, `UpsertReviewRequest.Text`) were plain
`string`. With nullable reference types ON, a plain `string` is implicitly
`[Required]`, so leaving an optional box blank sent `null` → 400
`ValidationProblemDetails` → rendered as "[object Object]". Made them `string?`.

### #2 Group chat error
No code bug — `sql/2026-07-19_add_event_chat.sql` had not been run. Table and proc
names verified against the real `Events` / `EventRSVPs` schema.

### #3 Badge design + clear-on-seen
`SocialContext` gained a per-account **seen ledger** in AsyncStorage
(`@trainwise_seen_challenge_invites_<uid>`). The badge counts only **unseen**
invites; `ChallengesScreen` calls `markChallengeInvitesSeen(ids)` on load with the
ids it just fetched (so it doesn't depend on the 90 s poll). Chip badge restyled
to match the tab/bell badge (fontSize 11, weight 800, 99+ cap).

### #4 Year chart redesign
The Year range was 12 cramped bars. Now a **bezier area/line chart**
(`LineChart` from the already-installed `react-native-chart-kit`), labelling every
other month anchored so the current month is always labelled.

### #5 Chart spacing
The injury-risk gauge wrapper used `Spacing.lg` while everything else used
`Spacing.md`. (Fully solved in §6 #5.)

### #6 Recovery sleep chart
Was nested inside the "recovery score exists" branch, so a user with sleep data
but no RHR/HRV saw the connect prompt instead of their sleep. Moved out: the 7-day
bar frame now **always renders** (with an `EMPTY_WEEK` skeleton), and the terse
"No sleep logged this week." became a friendly explanatory note.

### #7 Coach marketplace merged into the map
Removed the "Coaches" chip from the Connect community strip. Coach discovery and
reviews now live **only** in the map's Coaches filter. Fixed cropped text by
letting the rating text ellipsize (`coachStarsLeft` flex + `numberOfLines`) and
pinning the link (`coachRateLinkWrap`, `flexShrink: 0`).

### #9 Gesture / slide collision
`HomeRouter` wrapped the two dashboards in a horizontal `pagingEnabled`
ScrollView (My Trainees ⇄ My Training). That **outer** horizontal swipe stole every
**inner** horizontal glide — the Add-Workout and Add-Injury type scrollers on
HomeScreen. Converted to a **tap-only segmented toggle + conditional render**
(same fix already applied to AddWorkout's tabs). `MyCoachScreen`'s pager was left
alone: its pages are vertical lists, so there's no collision.

### #10 Two live-workout clocks merged into one
The Live tab had a stopwatch *and* a link to a separate full-screen interval
timer. Interval mode is now **inline**: a toggle plus work/rest/rounds steppers,
and the single running stopwatch drives the work/rest phases (haptic cue +
phase chip) while still logging total duration.
`TimerScreen` is now an orphan route (see §10).

### #11 Answer: does the trainee Load Trend need Python?
**No.** The trainee Load tab is served by **C#** —
`GET api/dailyload/user/{id}/analytics` via `LoadAnalyticsBL`. Only the **coach**
forecast/PMC screen uses the local Python service (`mlApi.js`, port 8000).

---

## 6. Device-test round 4 — 13 items

### #1 Language feature dropped (English only)
`i18n.js` rewritten: `t()` resolves against English only. Critically,
`initLanguage()` is now also a **migration** — anyone who had picked Hebrew had
`I18nManager.forceRTL(true)` written natively (it survives restarts), so removing
the picker would have stranded them in RTL forever. It now forces LTR back and
clears the saved preference. Settings card + `langRow`/`langLabel` styles removed.

### #2 Why no verification / reset email arrives
**There was no email-sending code anywhere in the backend.** The code was
generated, PBKDF2-hashed and stored — and that was it. The API still replied
*"a reset code was sent"*, which simply wasn't true. `AUTH_DEV_CODES` was the only
way to see a code.

**Built:** `BL/EmailSender.cs` — `System.Net.Mail` (no new NuGet), configured
**entirely from environment variables** so no credential touches source:

```
SMTP_HOST   SMTP_PORT (587)   SMTP_USER   SMTP_PASS   SMTP_FROM   SMTP_SSL
```

Wired into `RequestPasswordReset` and `RequestEmailVerification`. Best-effort:
returns `false` and logs when unset, so an outage can never break the auth flow.

### #3 How Devices & sessions worked (explanation → later rebuilt)
Two findings: the list was always empty (the client generates a **string**
`dev-<ts>-<rand>` id while `UserDevices.DeviceID` is numeric, and nothing ever
inserted a row), and "Log out" only deleted a row — it did **not** revoke the JWT
(30-day, no refresh, no blacklist). Rebuilt for real in §7.

### #4 GDPR privacy policy + terms
Full Article-6 / Article-9-structured Privacy Policy (controller, data categories,
special-category health data, legal basis, processors incl. Azure / Google /
OpenAI / FCM, transfers, retention, rights, security, children) and Terms
(medical disclaimer, "coaches are users we don't vet", acceptable use, liability,
termination). Rendered in a **scrollable modal** — `Alert.alert` truncates text
this long on Android.
⚠️ `CONTACT_EMAIL` is a placeholder; replace before any public release.

### #5 Chart spacing — real root cause
`RiskGauge`'s own `card` style carried `marginTop: 14` **on top of** the wrapper's
margin **and** the previous card's `marginBottom` → **46 px above, 0 px below**.
`RiskGauge` now matches the shared `<Card>` rhythm (`marginBottom: 16`, no top
margin), the wrapper lost its margin, and the Training Load card lost its extra
`marginTop`. Every gap is now 16 px.

### #6 Sort challenges + events by creation date
`sql/2026-07-19_sort_community_by_created.sql` redefines
`sp_GetChallengesForUser` and `sp_GetEventsForUser` with `ORDER BY CreatedAt DESC`.
(Safe to use `CREATE OR ALTER` here — both procs already exist.)

### #7 Group chat → full parity with the 1:1 chat
SQL `sql/2026-07-19_event_chat_full.sql`:
- `EventChatMessages` + `ImagePath` / `VideoPath` / `AudioPath`, `[Text]` made **nullable**
- new `EventMessageReactions` (one emoji per user per message)
- new `EventMessageReads` (read receipts)
- procs: `sp_PostEventMessage` (6 params, returns the saved row),
  `sp_GetEventMessages` (+`SeenCount`), `sp_MarkEventMessagesSeen`,
  `sp_ReactEventMessage`, `sp_GetEventReactions`

> FK note: the `Users` FKs are deliberately `NO ACTION` — `EventChatMessages`
> already cascades from `Events`, so cascading from `Users` too would give SQL
> Server multiple cascade paths and fail at CREATE.

Backend: `EventMessage` gained media + `SeenCount`; `PostEventMessage` returns the
saved row; new react / reactions endpoints. Reading a thread also marks it seen.

Frontend `EventChatScreen` rewritten: photos, videos, voice notes (expo-audio,
deterministic waveform + progress dot), pinch-to-zoom viewer, long-press emoji
reactions, blue links, "seen by N" receipts, mic-replaces-send composer.
**Media reuses the existing generic `uploadChatImage/Audio/Video` endpoints** — no
new upload plumbing.

### #8 `?` help now covers all three ranges
The old text was also *wrong* (it described "7-day rolling acute load" for a view
that shows daily load). Rewritten to explain Week / Month / Year and to note that
unconfirmed Health Connect imports don't count.

### #9 Kudos + Notes & Photo + "Log Another Workout" removed
Stripped from `WorkoutSummaryScreen` (state, handlers, JSX, styles, imports).

### #10 Profile name + Home "Champion"
The profile badge and name were a **single interpolated string**, so an equipped
badge could leave the name invisible — now separate elements in a `nameRow` with
`flexShrink`. On Home, the equipped title moved **beside** the name as a pill.

### #11 BMR base — root cause
The formula was always correct (77 kg / 186 cm / age 23 / male → 1822.5 → **1823**).
The bug was the plumbing: `calGoal = storedCalGoal ?? tdee`, so the **first tap of
the ±50 stepper** wrote a permanent override that silently shadowed the formula
forever (the stuck 1550). It also used **TDEE** (BMR × activity factor) while the
ring *separately* adds exercise calories — double-counting training.

Now: base = **`computeBMR`**; a confirmation dialog before the first override
(explaining it's a real Mifflin-St Jeor calculation); `clearCalorieGoal()` plus a
"tap to use the calculated one" reset; and a provenance line under the stepper.

### #12 Blue tappable links in both chats
New shared `src/utils/linkify.js`. Fixed a genuine bug in the old group-chat copy:
it called `.test()` on a **`/g`** regex, whose `lastIndex` persists between calls,
so links **alternated** between working and being skipped. The helper uses a
separate non-global anchored regex for testing, strips trailing punctuation, and
prefixes `https://` for bare `www.` links.

### #13 The +733% number — verified
It comes from `LoadAnalyticsSection`: **last 7 days vs the 7 days before**
(a *rolling* window), not the calendar bars above it.
**The arithmetic is correct** (90 → 750 = +733%).

But it was misleading twice: it sat under a *calendar-week* chart (so it looked
like it contradicted "570 → 180"), and a 90-unit baseline makes any percentage
explode. Kept the rolling comparison (it's the sound one: 7 full days vs 7 full
days, whereas the current calendar bar is a *partial* week), but the label now
reads "last 7 days vs the 7 before", the percentage is suppressed below a
`MIN_BASELINE` of 100 in favour of absolute values, and it caps at "over +300%".

---

## 7. Device-test round 5 — 4 items

### #1 Custom-base crash (critical)
`Alert` was **never imported** in `HomeScreen.js`, but the `resetCalGoal` added in
round 4 calls `Alert.alert()` → `ReferenceError` on tap. Same class as the
Settings crash: an undefined identifier that JS cannot catch at build time.

### #2 "Trop d'arguments … sp_PostEventMessage"
SQL saying *too many arguments*. The published backend passes 6 parameters but the
DB still had the **old 3-parameter** proc — the migration wasn't applied, or
`add_event_chat.sql` was re-run afterwards and silently downgraded it (DROP+CREATE).

Two defences added:
- `2026-07-19_event_chat_full.sql` is now **self-contained** (creates the table
  too), so running that one file always repairs the schema.
- `2026-07-19_add_event_chat.sql` is now **guarded** — its proc creation is
  wrapped in `IF COL_LENGTH('dbo.EventChatMessages','ImagePath') IS NULL` +
  `EXEC('CREATE PROCEDURE …')` (needed because `CREATE PROCEDURE` must start its
  own batch), so re-running it is a harmless no-op.

### #3 Devices & sessions — built for real
| Layer | What |
|---|---|
| SQL | `sql/2026-07-19_add_user_sessions.sql` — `UserSessions` table + 6 procs |
| Token | `JwtService.CreateToken(user, sessionId, tokenId)` adds a **`sid`** claim |
| Enforcement | `Program.cs` `JwtBearerEvents.OnTokenValidated` rejects the token if that session is revoked, and refreshes `LastSeenAt` (throttled) |
| BL | `SessionBL` — 10 s validity cache so it isn't a DB hit per request; 60 s touch throttle |
| API | `GET/DELETE /users/{id}/sessions`, `POST …/revoke-others` |
| Client | login sends real device name via `expo-device`; Settings shows a live list with a "This device" pill, last-active time, per-row **Sign out**, and **Sign out all other devices** |

**This is the part that makes it real:** previously a JWT stayed valid for its full
30 days no matter what the user clicked. Revocation is scoped by user id, so a
caller can never kill someone else's session by guessing an id. Signing out your
own device also logs you out locally. Legacy tokens have no `sid` and keep working
(they just can't be revoked); re-login upgrades them.

### #4 Keyboard layout bug
`AndroidManifest.xml` sets `windowSoftInputMode="adjustResize"`, so Android
**already** resizes the window for the keyboard. Every screen additionally passed
`KeyboardAvoidingView behavior="height"`, resizing it a *second* time and leaving a
stale offset on dismiss — which pushed the composer under the tab bar after
pressing back. Fixed to `behavior={undefined}` on Android (iOS keeps `'padding'`)
across **all 12 screens** that had it.

### Side question answered: how to set `SMTP_HOST`
- **Local (VS 2022):** Project Properties → Debug → *Open debug launch profiles UI*
  → Environment variables → add the five. Restart the debug session.
- **Azure:** App Service → Configuration → Application settings → add each → Save
  (auto-restarts).
- **Gmail** needs 2-Step Verification + an **App Password** (a normal password will
  not authenticate over SMTP). ~500 emails/day.
- **SendGrid** alternative: host `smtp.sendgrid.net`, user literally `apikey`,
  pass = the API key.

---

## 8. Load Trend correction + #174 trainee self-analytics (the LAST medium feature)

Before building the final backlog item, the user asked to confirm an assumption:
*"the load trend needs to be coded just like the forecast so it correlates with
the python ml course"*.

### The correction (I was wrong twice before this)
Earlier in this document (§5 #11, §6 §7-item-11) I stated the trainee Load Trend
is **C#-driven and doesn't need Python** — that was **wrong**, and the user
caught it. Reading the actual fetch code in `components/LoadAnalyticsSection.js`
proved the trainee Load Trend (Classic rolling ACWR + Smooth EWMA) is
**Python-primary**, the exact same architecture as the coach forecast:

```
useEffect fetch order:
  1. services/mlApi.getTraineeAnalytics()   → Python /api/ml/trainee/{id}/analytics  (PRIMARY)
  2. services/api.getLoadAnalytics()        → C# LoadAnalyticsBL                     (fallback)
  3. utils/loadSeries.computeLoadAnalytics()→ on-device JS mirror                    (last resort)
```

The wrong claim traced back to **stale documentation**: both CLAUDE.md's load-
analytics section and the file's own header comment still said *"C# is the
source of truth"* — true when written 2026-07-05, but the fetch order was later
flipped to Python-first and nobody updated the docs. All three were fixed:
- `CLAUDE.md` — load-analytics section rewritten to state Python-primary + why
  the old text was wrong (kept for history, corrected in place).
- `components/LoadAnalyticsSection.js` header comment — rewritten with the
  verified fetch order.
- The project's persistent memory record — corrected in place with a note that
  the earlier answer was wrong.

**Lesson**: when asked how a data flow works, read the fetch/call code, never
the doc-comment or CLAUDE.md — comments drift when code changes and stop being
ground truth.

### #174 — Trainee self-analytics (final backlog spec)
> **Goal** (from `feature_backlog.md`): give trainees their own PMC/ACWR charts
> (today coach-only). **Touches**: reuse `CoachTraineeAnalyticsScreen` charts +
> `mlApi.js` for the logged-in user; add to Profile/Stats. **Acceptance**: a
> trainee sees their own PMC + ACWR safe-zone charts.

**First attempt** (superseded, see §9): a new shared `components/PerformanceCharts.js`
(`PmcCard`, `AcwrCard`, `LineChartSvg`, `buildPmcModel`, `buildAcwrModel`)
extracted from `CoachTraineeAnalyticsScreen`, plus a new `screens/MyAnalyticsScreen.js`
showing only PMC + ACWR (no forecast — the spec only asked for those two charts).
Wired: `MyAnalytics` route in `NavigationStack.js`, a "My analytics" button on
`ProfileScreen` (gated `!isCoachOnly`).

No SQL, no backend changes — `getTraineePMC` / `getTraineeACWR` (Python
`/api/ml/trainee/{id}/pmc` and `/acwr`) already existed for the coach screen.

---

## 9. Follow-up fixes after #174

Two changes requested immediately after testing the first #174 build.

### "Where is the forecast?"
The user's device screenshot showed only the PMC and ACWR charts and asked
where the monthly forecast was — the first attempt deliberately left it as a
coach-only tool since the backlog spec only mentioned "PMC/ACWR charts." Given
the user wants the forecast too, the design changed to **reuse the entire
`CoachTraineeAnalyticsScreen`** (which already has PMC + ACWR + the full
monthly forecast — headline, risk pill, projected-ratio chart, per-week rows,
month picker) instead of a partial rebuild:

- `CoachTraineeAnalyticsScreen` gained an `isSelf` flag, read from
  `route.params.self`. When true: the header becomes "My analytics", and the
  forecast lead becomes "If you keep training like this:" (first person)
  instead of "If {name} keeps training like this:".
- The `MyAnalytics` route now points directly at `CoachTraineeAnalyticsScreen`
  (not a separate screen).
- `ProfileScreen`'s "My analytics" button navigates with
  `{ self: true, trainee: { userID: user.userId, fullName: user.fullName } }`.
- **Deleted** the first-attempt files — `components/PerformanceCharts.js` and
  `screens/MyAnalyticsScreen.js` — since they only covered PMC + ACWR and fully
  duplicated logic that now has a single source (the coach screen). Verified no
  remaining imports of either file before deleting.

Net result: trainee and coach views can never drift, because they are literally
the same component reading the same Python endpoints; zero duplicated chart code.

### "Remove Visit Shop from Profile, leave only Analytics"
`ProfileScreen`'s "Visit Shop" button was removed. Verified before removing that
the Shop is **not orphaned** — it's still reachable from the coins chip in
`components/HomeHeader.js` (`onPress={() => go('Shop')}`), which is the primary
entry point users already use daily.

### Minor UI fix in the same round: alert button clipping
Screenshot showed the "Keep the formula" button (from the BMR confirm dialog,
§6 #11) clipped off the left edge of its dialog. Root cause: **not** a native
Android dialog — it's the app's own `components/AppAlertProvider.js`, which
monkey-patches `Alert.alert` app-wide. Its button row was
`flexDirection:'row'` + `justifyContent:'flex-end'` with **no `flex` on the
buttons**, so two buttons whose combined intrinsic width exceeded the card
overflowed off the **start** edge (not the end, where `flex-end` looks safe).

Fixed generally — every 2-button alert in the app benefits, not just this one:
- Buttons in a non-stacked (≤2 button) row now get `flex: 1` (equal halves),
  so they can never overflow the card.
- Button text gets `numberOfLines={1}` as a final guard.
- The specific label was also shortened, "Keep the formula" → "Keep formula",
  since each button now only gets half the card width.

### PC IP drift (unrelated, same session)
The user's DHCP lease flipped the PC's LAN IP between `.118` and `.117` more
than once this arc. `src/config/backend.js`'s `LOCAL_PC_IP` and
`src/services/mlApi.js`'s hardcoded `ML_BASE_URL` were found out of sync
(`.118` vs `.117`) and aligned to `.117`, then the APK was rebuilt. Reminder:
these two files are **not** wired together (per the existing "Known pending
items" in CLAUDE.md) — a future IP change must be applied to BOTH by hand.

**No SQL, no backend changes in this round** — purely a frontend `route.params`
rewire + file deletion + a UI styling fix.

---

## 10. Deployment checklist

1. **Run the SQL** (see §11) on local SQL Express **and** Azure SQL.
2. **Publish the C# backend** — required for: nullable DTO fix, group-chat media
   endpoints, `EmailSender`, and the whole sessions feature.
3. **Install the APK** — `TrainWiseExpo/android/app/build/outputs/apk/release/app-release.apk`.
4. *(Optional)* set `SMTP_*` to turn on real emails.
5. *(Optional)* set `AUTH_DEV_CODES=true` to demo reset/verify without SMTP.

**Build command** (never `gradlew clean` on this project):
```bash
cd TrainWiseExpo/android && ./gradlew --stop && rm -rf app/.cxx app/build \
  && NODE_OPTIONS='--max-old-space-size=8192' ./gradlew assembleRelease --no-parallel
```
Always verify the APK's **timestamp and size changed** — `BUILD SUCCESSFUL` alone
does not guarantee a repackage.

---

## 11. Migration run order

New in this arc, in order:

| # | File | Purpose |
|---|---|---|
| 1 | `2026-07-17_add_auth_batch.sql` | `AuthCodes` (reset + verify codes) |
| 2 | `2026-07-17_add_community_batch.sql` | Challenges, Events, RSVPs, CoachReviews |
| 3 | `2026-07-17_add_coach_comments_and_cascade.sql` | `WorkoutComments` (now dormant) + `sp_DeleteUser` cascade |
| 4 | `2026-07-19_fix_challenges.sql` | invite/join status, cosmetics in standings |
| 5 | `2026-07-19_add_event_chat.sql` | group chat base *(superseded, now guarded)* |
| 6 | `2026-07-19_event_chat_full.sql` | **media + reactions + read receipts (self-contained)** |
| 7 | `2026-07-19_sort_community_by_created.sql` | sort challenges/events newest-first |
| 8 | `2026-07-19_add_user_sessions.sql` | **real device sessions + revocation** |

> If you ever see *"Too many arguments are specified for procedure
> sp_PostEventMessage"*, just re-run **#6** — it repairs the schema on its own.

---

## 12. Dormant / unused code left behind

Kept in the tree deliberately (harmless, easy to revive):

| Item | Status |
|---|---|
| `src/screens/FeedScreen.js` | #144 dropped — file remains, route unregistered |
| `src/components/WorkoutComments.js` | #134 dropped — unmounted |
| `WorkoutComments` table + controller/BL/DAL | dormant backend |
| `src/screens/TimerScreen.js` | still registered as a route, but **nothing navigates to it** since the interval timer was merged inline |
| Kudos + workout-notes endpoints (`getKudos`, `toggleKudos`, `getWorkoutNotes`, `setWorkoutNotes`) | dormant after §6 #9 |
| `sp_GetActivityBests` / `getActivityBests` (#165) | server-side bonus; client uses `computePersonalBests` |
| `getActivityFeed` community endpoint | dormant |
| `computeTDEE` in `utils/calories.js` | no longer used by the ring (documented why) |
| `UserDevices` table + endpoints | superseded by `UserSessions` |
| `src/i18n/translations.js` `LANGUAGES` | no longer imported by `i18n.js` |
| Unused `woFooter` / `woReview` / `woReviewText` styles | `CoachTraineeDetailScreen.js` |
| `src/components/PerformanceCharts.js` + `src/screens/MyAnalyticsScreen.js` | first-attempt #174 files, **deleted** (§9) once the design changed to reuse `CoachTraineeAnalyticsScreen` directly |

---

## 13. Lessons recorded

Ten entries appended to `tasks/lessons.md` dated 2026-07-19. The most reusable:

1. **`CREATE OR ALTER` is unsafe for brand-new procs** — can resolve to `ALTER`
   → Msg 208 State 6. Use DROP + CREATE for new objects.
2. **Cross-table cleanup procs must not assume `UserID`** — grep each table's real
   owner column first.
3. **A themed screen crashing on mount with no message = a bad palette token in
   `makeStyles`.** The param name differs per file (`Colors` vs `C`); a child
   `ErrorBoundary` cannot catch it — put the boundary at the navigator level.
4. **Never nest two horizontal swipe surfaces** — an outer `pagingEnabled`
   ScrollView steals every inner horizontal gesture. Use a tap toggle.
5. **A computed value with a manual override** needs a confirmation before the
   first override, a visible reset, and a label saying which is in effect.
6. **A % change needs its window stated** when it differs from the adjacent chart,
   and must be suppressed below a minimum baseline.
7. **Never return a success message for an action the code doesn't perform**
   (the "a reset code was sent" that sent nothing).
8. **Never call `.test()` on a `/g` regex** — `lastIndex` persists.
9. **After adding a call to any react-native API, grep that file's import block** —
   RN imports symbols individually, so a new API is a guaranteed runtime crash.
10. **On Android with `adjustResize`, `KeyboardAvoidingView` must use
    `behavior={undefined}`** — `'height'` double-resizes and leaves a stale offset.
11. **When asked how a data flow works, read the fetch/call code, not the doc-
    comment or CLAUDE.md** — comments drift when code changes (this is exactly
    how the Load Trend "C# not Python" mistake happened, twice).
12. **A horizontal button row needs `flex: 1` on each button**, not just
    `justifyContent: 'flex-end'` — intrinsic-width children silently overflow
    the START edge (not the end) when they don't fit the container.

---

## 14. Known gaps / not done

- **`AUTH_ENFORCE` is still off.** Tokenless legacy calls are permitted, so session
  revocation only bites when the app actually sends its token. Flip to `true`
  once the new APK is confirmed logging in cleanly, for the full security benefit.
- **`CONTACT_EMAIL` in the privacy policy is a placeholder.** GDPR requires a
  reachable controller contact.
- **SMTP is unconfigured**, so emails still don't send until `SMTP_HOST` is set.
- **Python ML service is still local-only** — deploying `ml/app.py` to Azure
  (pymssql + SQL auth) remains the standing roadmap item. **Corrected in §8:**
  the trainee Load Trend DOES need it (Python-primary), same as the coach
  forecast and now the trainee's own analytics (#174) — all three surfaces
  degrade to a fallback when the service is offline, but their LIVE numbers all
  depend on `ml/app.py` running on the same LAN.
- **Docs suite lives on `main`.** This working branch (`Lirone's-Branch`) has no
  `docs/` or `README.md`, so the CLAUDE.md doc-sync trigger map could not be
  applied here — it must be done when merging to `main`.
- **`ml/features.py` and the JS mirrors** (`utils/loadSeries.js`, `utils/acwr.js`)
  must stay in step with `LoadAnalyticsBL` — unchanged this arc, but worth
  re-checking after any load-math edit.
- **`src/services/mlApi.js`'s `ML_BASE_URL` and `src/config/backend.js`'s
  `LOCAL_PC_IP` are two separate hardcoded values** — a PC IP change (DHCP) must
  be applied to BOTH by hand, or one service silently points at a dead IP while
  the other works. Wiring `mlApi.js` to import `LOCAL_ML_URL` from `backend.js`
  is a known pending item that would fix this permanently.

### Backlog status
With #174 shipped (§8-§9), **every 🟢 and 🟡 item in `tasks/feature_backlog.md`
is now built.** The only items left unbuilt are the 🔴 (hard / large-scope) ones:
live GPS run recording (#121 — only post-hoc route *display* exists today),
assigned training programs (#133), squad/team coaching (#136), in-app coaching
payments (#168), AI video form analysis (#177), watch/Wear OS companion (#182),
offline mode + sync queue (#158), Android home-screen widget (#159), and the
what-if forecast simulator (#185).
