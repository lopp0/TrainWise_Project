# TrainWise — Features List

> Presentation‑ready inventory of every user‑facing and behind‑the‑scenes feature **that exists today**.
> Grouped by theme (not by the sprint it shipped in). For the technical / API breakdown (controllers,
> endpoints, integrations) see [`features.md`](features.md). Items not yet built are collected at the end
> under [Planned / Not yet implemented](#planned--not-yet-implemented).

---

## Auth & Accounts
1. Welcome / landing screen — first entry point for guests
2. Login — email + password sign‑in (`POST /api/auth/login`, PBKDF2‑verified, returns a JWT bearer token)
3. Two‑step registration — basic info + gender, then preferences + terms (`SignUpScreen` → `SignUpFinal`),
   with a **reCAPTCHA** gate that opens in a **full‑screen modal** (so Google's image‑challenge has room to
   render and scroll) and whose token is **verified server‑side** (`CaptchaVerifier` → Google `siteverify`)
   before the account is created
4. Role picker — `trainer` / `trainee` / `both` → sets `IsCoach` / `IsTrainee` independently
5. Google sign‑in — **native** account picker (`@react-native-google-signin`, no WebView/redirect) on
   both Login and Sign Up; the Sign‑Up path requires TOS + Privacy consent. Sends the Google **ID token**
   to `POST /api/users/google-login`, which **verifies it server‑side** before find‑or‑create
6. Health declaration + terms confirmation at signup
7. Profile screen — view / edit personal + training info
8. Settings — update profile, week‑start, theme, reset tutorials
9. Profile picture upload — tappable avatar, camera or library (multipart to `wwwroot/images`)
10. Logout — clears the persisted session
11. **Forgot / reset password** — 6‑digit PBKDF2 code, single‑use, 15‑min TTL, emailed to the user
    (`ForgotPasswordScreen`, `POST /api/auth/forgot|reset`); never reveals whether an email exists
12. **Email verification** — 60‑min emailed code flips `Users.EmailVerified` (`POST /api/auth/verify/request|confirm`)
13. **Biometric unlock** — face / fingerprint app lock (`utils/biometric.js`, `BiometricLockOverlay`)
14. **Change password + strong‑password rules** — eye‑toggle + live requirements checklist
    (`PUT /api/users/{id}/password`, `PasswordInput`, `PasswordRequirements`, `validation.js`)
15. **GDPR privacy policy + terms** (scrollable modal) + strict in‑app email validation (real TLD check)

## Home / Load Dashboard
16. Home dashboard — weekly per‑day **load bars**, color‑coded by session load
17. Acute‑load tile + **AC ratio (ACWR)** with a green / yellow / red status
18. Streak + coins display
19. Smart suggestion card on Home (`SmartSuggestionCard`) — today's recommendation surfaced up front
20. Greeting header with avatar (`HomeHeader`)
21. Scroll‑to‑top + focus‑refresh (data re‑fetches when you return to the tab)
22. Coach‑only routing — a coach‑only user lands directly on the coach dashboard (`HomeRouter`)

## Workouts & Activity
23. Add workout — foldable form, two tabs, sliders, target stepper, break button
24. 20 activity types with per‑type intensity factor (seeded reference data)
25. Edit / delete a workout (Stats) with automatic `DailyLoad` recalculation
26. Workout summary screen
27. **Route maps** for cardio (running / walking / swimming / hiking) via `expo-maps`
28. Stats screen — weekly bar chart + zoomed per‑day view (shared color logic with Home)
29. Session load = `duration × exertion`; rolled into acute / chronic load server‑side
30. **Exercise library** — searchable exercise catalog + body‑map picker (`ExerciseLibraryScreen`,
    `bodyRegions`, `BodyMapPicker`)
31. **Workout templates** — save + reuse workouts (`api/workouttemplates`, `WorkoutTemplatesController`)
32. **Shared / public workouts** — share a workout to a public link (`PUT /api/activitylog/{id}/share`,
    `SharedWorkoutScreen`)
33. **Heart‑rate zones** — HR‑zone breakdown of a session (`HeartRateZones`, `utils/hrZones`)
34. **Live GPS run tracking (#121)** — record your own outdoor route (start / pause / resume / finish),
    drawn live with a **background foreground service** for screen‑off tracking (`expo-task-manager`,
    `LiveRunScreen`, `utils/liveTracking.js`); saved as an ActivityLog + an on‑device polyline

## Nutrition
35. **Nutrition tracking** — calorie + macro log with a `CalorieRing`, plus barcode scan via Open Food Facts
    (`NutritionScreen`, `api/nutrition`, `utils/calorieLog`, `utils/calories`, `utils/openFoodFacts`)

## Injuries
36. Injury report — type, severity slider (1–10), doctor's notes
37. **Scan injury (photo)** — camera or library capture
38. **AI advice** — builds a prompt from injury type + severity + notes (OpenAI)
39. **Send to coach** — uploads the scan + sends a summary through chat to every linked coach
40. Active injuries list with a per‑row **Mark Recovered** button
41. 20 injury types + categories (seeded), injury‑specific icons
42. **Injury‑risk gauge + rehab tips** — `RiskGauge`, `RehabSuggestions`, `utils/injuryRisk`, `utils/rehabTips`

## Recovery & Readiness
43. **Readiness & recovery** — daily readiness score + recovery guidance (`ReadinessCard`, `utils/recovery`,
    `utils/restRecommendation`)

## Health Connect (Android)
44. Read‑only sync of workouts from Google Health Connect
45. Permission request flow (six health read permissions)
46. De‑dupe by start time + persistent **tombstones** (deleted HC workouts don't re‑import)
47. Per‑row delete on the Health screen with recalc
48. Calories via `ActiveCaloriesBurned`, BMR‑corrected `TotalCaloriesBurned` fallback
49. "Connected" banner + unconfirmed‑count badge on the Health tab

## Coach ↔ Trainee
50. Coach dashboard — list of connected trainees
51. Per‑trainee load drill‑down (`CoachTraineeDetail`)
52. **QR connect** — scan a code to link coach ↔ trainee (`ConnectQR`)
53. Coach‑authored recommendations (`CoachRecommendations`)
54. Coach **Analytics** screen — PMC + ACWR charts + monthly forecast (ML‑backed)
55. Lazy coach‑row creation on accept (trainee → coach flip works later)
56. A trainee can be linked to **multiple coaches** (per‑coach inbox + unread)
57. **Coach marketplace + reviews / ratings** — discover + rate coaches (`CoachMarketplaceScreen`, merged
    into the map's Coaches filter)
58. **Assigned training programs (#133)** — a coach builds a reusable **weekly** program and assigns it;
    sessions fan out onto the trainee's calendar (one per day) (`ProgramBuilder` / `CoachPrograms` /
    `MyPrograms` / `ProgramDetail`, `api/programs`)

## Chat & Messaging
59. WhatsApp‑style **user↔user chat** (coach↔trainee and friend↔friend share one backend)
60. Image messages + full‑screen image viewer
61. Read receipts (auto‑marks incoming messages seen)
62. Unread badge + local notification when the unread total rises
63. Per‑coach unread, derived client‑side, in the My Network hub
64. Focus‑gated polling (cheap when the screen isn't open)
65. **Voice + video messages** — record / upload audio + video in chat (`POST /api/messages/upload/audio|video`,
    `VideoPlayerModal`, `ZoomableImage`)

## Connect / Social
66. Connect tab — a map of **gyms** + a proximity‑sorted list of people (exact coordinates never shown)
67. Friends — request / accept / decline / unfriend
68. 10 real Netanya gyms on the map (name + address + coords from Google Places)
69. **Presence heartbeat** — online dots; "online" = seen within 5 minutes
70. Coach offers — a coach can offer to coach a nearby trainee; accept links them
71. Filter (Trainees / Coaches / Gyms) + sort (Nearest / Name A–Z)
72. Resizable map (drag handle between map and list)
73. **My Network hub** — swipe between Coaches and Friends, per‑contact unread + presence
74. Requests inbox (`RequestsScreen`) — accept / decline, pushes the other side
75. Live‑location share toggle + map pins

## Community & Events
76. **Friend challenges** — load / workouts / distance, invite → accept, live standings with cosmetics
    (`ChallengesScreen`, `api/community/challenges`)
77. **Group events + RSVP** — create events, RSVP, attendee list (`EventsScreen`)
78. **Event group chat** — photos, videos, voice notes, reactions, read receipts (`EventChatScreen`,
    full 1:1‑chat parity)

## Gamification
79. XP / coins economy
80. **Personal records** — auto‑detected on workout save (`PersonalRecords`)
81. **Per‑activity personal‑best dashboard (#165)** — longest duration / distance / load per activity,
    computed client‑side from confirmed logs (`utils/personalBests`)
82. Badges awarded from user stats
83. Public **workout board** — posts with photos + likes (`WorkoutBoard`)
84. **Workout‑board comments** — comment threads on board posts (`GET/POST /api/board/{postId}/comments`,
    `WorkoutComments`)
85. **Weekly leaderboard** (opt‑in) ranked by load, with a **Global / Friends** scope toggle (`Leaderboard`)
86. **Seasonal divisions (#149)** — Bronze → Diamond tiers derived from your rank in the rolling weekly
    leaderboard (`utils/divisions`)
87. **Training calendar** — plan workouts, log exertion on completion (`TrainingCalendar`)
88. Cosmetics **shop** + equip (avatar cosmetics on profiles)
89. Activity streaks
90. **Goals + quests** — goal cards + gamified quests (`GoalCard`, `QuestsCard`, `utils/goals`, `utils/quests`)
91. **Share achievement / PR (#172)** — push a record to the OS share sheet (any app), no extra native module
    (`utils/shareAchievement`)

## Smart Workout & Weather
92. Multi‑factor smart‑workout suggestion (`utils/smartWorkout.js`)
93. Google **Weather API** — temp, feels‑like, humidity, wind, UV, precipitation, cloud
94. Google **Air Quality API** — Universal AQI (0–100, higher = cleaner)
95. 0–100 conditions score (Great / Good / Fair / Poor) with a per‑factor traffic‑light breakdown
96. AC ratio > 1.3 overrides any suggestion to **recovery**
97. Recommended activity chips + collapsible card

## AI Chatbot
98. In‑app AI chat (`AIChatScreen`) — calls OpenAI directly from the device; **history persists per user**
    (AsyncStorage) with a clear button
99. Injury AI advice reuses the same text model
100. **"Ask my data" (#176)** — recent training logs are distilled into a grounded context block injected
     into the chat's system prompt, so the assistant can answer "how many workouts this week?" accurately
     (`utils/aiDataContext`)
101. **AI weekly recap + AI plan** — the recap is folded into the unified "This week at a glance" card;
     `AIPlanScreen` builds a chronologically‑sorted suggested week

## ML Analytics & Forecast (Python service)
102. **PMC** chart — Fitness / Fatigue / Form, from `react-native-svg`
103. **ACWR safe‑zone** chart — shaded 0.8–1.3 band
104. **Monthly forecast** — per‑trainee regression projecting acute load + AC ratio + risk
105. Forecast **history** dropdown (past months read‑only via `MonthlyForecasts`)
106. Injury‑risk classifier (pickle model with a rule‑based fallback)
107. Service mirrors the C# load formula exactly so numbers line up with the app
108. Gradeable Jupyter notebooks (cleaning, EDA, regression + classification metrics, KMeans; what‑if planner)
109. **Trainee self‑analytics (#174)** — trainees get their own PMC + ACWR + monthly forecast (reuses
     `CoachTraineeAnalyticsScreen` with an `isSelf` flag)
110. **What‑if forecast simulator (#185)** — dial in "add N sessions this week at easy / medium / hard" and
     watch the projected **ACWR** risk pill flip green → amber → red *before* the sessions are trained
     (`GET /api/ml/trainee/{id}/whatif`, planner card in the analytics screen)

## Notifications
111. Load‑aware **daily reminder** (18:00) with Duolingo‑style escalation tiers
112. Workout **warning push** on confirm (Yellow / Red zones only)
113. Social pushes — friend requests / accepted friends / coach offers
114. Messages unread push (fires when the total unread count rises)
115. Push‑token plumbing (FCM) + in‑app banner for foreground events

## Theme & UX
116. Light / dark **theming** — runtime‑swappable palette across every screen (`useThemedStyles`)
117. Week‑start setting — single source of truth for the rolling charts
118. **Per‑screen tutorials** — first‑visit walkthroughs on 11 screens (`ScreenTutorial`, `utils/tutorialManager`),
     replacing the old app‑wide onboarding overlay; re‑playable via **Reset tutorials** in Settings
119. Tap‑outside‑to‑dismiss everywhere; themed date/time picker
120. App logo, splash screen, notification silhouette icon
121. Crash‑resilient UI (`ErrorBoundary`) + in‑app themed alerts (`AppAlertProvider`)

## Load Analytics & Extras
122. **Rolling + EWMA load analytics** — `GET /api/dailyload/user/{id}/analytics` (timezone‑aware) +
     `LoadAnalyticsSection` / `AcwrTrendChart`
123. **Achievements + milestones** — `AchievementsScreen`, `utils/achievements`, `utils/milestones`
124. **Workout timer** — `TimerScreen`
125. **Body‑measurement / weight tracker** — `WeightTracker`, `GET/POST /api/users/{id}/measurements`
126. **Pain tracker** — per‑injury pain logs (`GET/POST /api/injuryreport/{id}/pain`, `PainTracker`)
127. **Message reactions + typing indicator** — `POST /api/messages/{id}/react`, `PUT/GET /api/messages/typing`
128. **Workout‑board kudos** — `POST /api/board/kudos/{logId}/{userId}`
129. **Activity notes** — `GET/PUT /api/activitylog/{id}/notes`
130. **What's‑new modal + changelog**, theme scheduling, streak freeze
131. **Load history + export** — history card + data export (`LoadHistoryCard`, `utils/loadHistory`, `utils/exportHistory`)
132. **Trainee progress report** — a styled, self‑contained HTML report of records + per‑activity bests +
     recent load, shared via the OS sheet (`utils/progressReport`, `expo-sharing`)

## Backend Cross‑Cutting
133. Three‑layer architecture — `Controllers → BL → DAL → DBservice`
134. Raw ADO.NET over **stored procedures** (no EF Core)
135. **29 REST controllers** under `api/[controller]`
136. Core **training‑load algorithm** in `BL/LoadCalculationBL.cs` (acute, chronic, AC ratio, warning level)
137. Static file serving for uploaded images
138. Swagger / OpenAPI explorer (development only)
139. Seeded reference data + 20+ dated migration scripts (through `2026-07-27_fix_activitylog_procs.sql`)
140. **TrainWise.Tests** — xUnit project pinning the load‑math (18 hand‑computed vectors)

## Security & Auth Hardening (2026‑07‑02 audit)
141. **JWT bearer auth** — signed token issued on login / signup / google‑login; bearer interceptor on every client call
142. **Per‑object ownership checks** — a logged‑in user can't act on another user's data (IDOR/BOLA closed); `GET /api/users` → 403
143. **PBKDF2 password hashing** — salted, verify‑and‑upgrade from the old plaintext; constant‑time login (no user enumeration)
144. **Rate limiting** — auth endpoints (10/min/IP) + a global backstop
145. **Upload validation** — magic‑byte sniff + size cap + GUID (non‑enumerable) filenames
146. **Server‑side verification** — Google **ID token** + **reCAPTCHA** checked on the backend
147. **DB secret externalized to env** + **optional ML‑service JWT** (`ml/auth.py`, gated by `ML_AUTH_ENFORCE`)
148. **Real device sessions + revocation** — list devices, "sign out", "sign out all other devices";
     JWT `sid` claim enforced server‑side (`api/users/{id}/sessions`)

## External Services & Integrations
> Each row is one external dependency.

149. Azure App Service — hosts the C# API
150. Azure SQL Database — primary datastore (`TrainWiseDB`)
151. Google Maps SDK — map rendering + routes
152. Google Weather API — weather factors (separate SKU)
153. Google Air Quality API — AQI factor (separate SKU)
154. OpenAI — in‑app AI chat + injury advice
155. Firebase Cloud Messaging — push notifications
156. Google Health Connect — workout import (Android)
157. Google Sign‑In / OAuth — social login
158. Google Places API — nearby‑gyms search (server‑side proxy, `GOOGLE_PLACES_KEY`)
159. Open Food Facts — nutrition barcode lookup (free public API, no key)
160. **Maileroo** — transactional email API that delivers the password‑reset + verification codes
     (`BL/EmailService.cs`; API key in .NET user‑secrets locally / `Maileroo__ApiKey` env var in Azure, never committed)

---

## Planned / Not yet implemented

Empty placeholders for future work — present in comparable projects, **not** built in TrainWise today:

- **CI/CD** — GitHub Actions build + test on PRs, gated deploy on merge (today: manual publish from VS 2022)
- **Secret scanning** — `gitleaks` pre‑commit hook + CI scan (today: manual safe‑push checklist)
- **Static analysis** — CodeQL + `npm audit` / `dotnet list package --vulnerable` gates
- **iOS app** — the Expo iOS shell is unmaintained (Android only)
- **Content‑safety moderation** — screening of user‑generated text / images
- **Web / PWA client** — TrainWise is native‑only

**🔴 Hard backlog — the only 6 unbuilt features:** squad / team coaching (#136), in‑app coaching payments
(#168), AI video form analysis (#177), Wear OS watch companion (#182), offline mode + sync queue (#158), and
the Android home‑screen widget (#159).

> Previously‑planned items now **shipped** and moved into their theme above: cloud ML (the Python service is
> live on Azure — see *ML Analytics & Forecast*), persistent AI chat history (see *AI Chatbot*), live GPS
> tracking / assigned programs / what‑if planner (the 3 hard features that are done).
