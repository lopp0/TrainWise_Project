# TrainWise — Features List

> Presentation‑ready inventory of every user‑facing and behind‑the‑scenes feature **that exists today**.
> Grouped by area. For the technical / API breakdown (controllers, endpoints, integrations) see
> [`features.md`](features.md). Items not yet built are collected at the end under
> [Planned / Not yet implemented](#planned--not-yet-implemented).

---

## Auth & Accounts
1. Welcome / landing screen — first entry point for guests
2. Login — email + password sign‑in (`POST /api/auth/login`, validated by `sp_LoginUser`)
3. Two‑step registration — basic info + gender, then preferences + terms (`SignUpScreen` → `SignUpFinal`)
4. Role picker — `trainer` / `trainee` / `both` → sets `IsCoach` / `IsTrainee` independently
5. Google sign‑in — `POST /api/users/google-login` + native Google Sign‑In plugin
6. Health declaration + terms confirmation at signup
7. Profile screen — view / edit personal + training info
8. Settings — update profile, week‑start, theme
9. Profile picture upload — tappable avatar, camera or library (multipart to `wwwroot/images`)
10. Logout — clears the persisted session

## Home / Load Dashboard
11. Home dashboard — weekly per‑day **load bars**, color‑coded by session load
12. Acute‑load tile + **AC ratio (ACWR)** with a green / yellow / red status
13. Streak + coins display
14. Smart suggestion card on Home (`SmartSuggestionCard`) — today's recommendation surfaced up front
15. Greeting header with avatar (`HomeHeader`)
16. Scroll‑to‑top + focus‑refresh (data re‑fetches when you return to the tab)
17. Coach‑only routing — a coach‑only user lands directly on the coach dashboard (`HomeRouter`)

## Workouts & Activity
18. Add workout — foldable form, two tabs, sliders, target stepper, break button
19. 20 activity types with per‑type intensity factor (seeded reference data)
20. Edit / delete a workout (Stats) with automatic `DailyLoad` recalculation
21. Workout summary screen
22. **Route maps** for cardio (running / walking / swimming / hiking) via `expo-maps`
23. Stats screen — weekly bar chart + zoomed per‑day view (shared color logic with Home)
24. Session load = `duration × exertion`; rolled into acute / chronic load server‑side

## Injuries
25. Injury report — type, severity slider (1–10), doctor's notes
26. **Scan injury (photo)** — camera or library capture
27. **AI advice** — builds a prompt from injury type + severity + notes (OpenAI)
28. **Send to coach** — uploads the scan + sends a summary through chat to every linked coach
29. Active injuries list with a per‑row **Mark Recovered** button
30. 20 injury types + categories (seeded), injury‑specific icons

## Health Connect (Android)
31. Read‑only sync of workouts from Google Health Connect
32. Permission request flow (six health read permissions)
33. De‑dupe by start time + persistent **tombstones** (deleted HC workouts don't re‑import)
34. Per‑row delete on the Health screen with recalc
35. Calories via `ActiveCaloriesBurned`, BMR‑corrected `TotalCaloriesBurned` fallback
36. "Connected" banner + unconfirmed‑count badge on the Health tab

## Coach ↔ Trainee
37. Coach dashboard — list of connected trainees
38. Per‑trainee load drill‑down (`CoachTraineeDetail`)
39. **QR connect** — scan a code to link coach ↔ trainee (`ConnectQR`)
40. Coach‑authored recommendations (`CoachRecommendations`)
41. Coach **Analytics** screen — PMC + ACWR charts + monthly forecast (ML‑backed)
42. Lazy coach‑row creation on accept (trainee → coach flip works later)
43. A trainee can be linked to **multiple coaches** (per‑coach inbox + unread)

## Chat & Messaging
44. WhatsApp‑style **user↔user chat** (coach↔trainee and friend↔friend share one backend)
45. Image messages + full‑screen image viewer
46. Read receipts (auto‑marks incoming messages seen)
47. Unread badge + local notification when the unread total rises
48. Per‑coach unread, derived client‑side, in the My Network hub
49. Focus‑gated polling (cheap when the screen isn't open)

## Connect / Social
50. Connect tab — a map of **gyms** + a proximity‑sorted list of people (exact coordinates never shown)
51. Friends — request / accept / decline / unfriend
52. 10 real Netanya gyms on the map (name + address + coords from Google Places)
53. **Presence heartbeat** — online dots; "online" = seen within 5 minutes
54. Coach offers — a coach can offer to coach a nearby trainee; accept links them
55. Filter (Trainees / Coaches / Gyms) + sort (Nearest / Name A–Z)
56. Resizable map (drag handle between map and list)
57. **My Network hub** — swipe between Coaches and Friends, per‑contact unread + presence
58. Requests inbox (`RequestsScreen`) — accept / decline, pushes the other side
59. Live‑location share toggle + map pins

## Gamification
60. XP / coins economy
61. **Personal records** — auto‑detected on workout save (`PersonalRecords`)
62. Badges awarded from user stats
63. Public **workout board** — posts with photos + likes (`WorkoutBoard`)
64. **Weekly leaderboard** (opt‑in) ranked by load (`Leaderboard`)
65. **Training calendar** — plan workouts, log exertion on completion (`TrainingCalendar`)
66. Cosmetics **shop** + equip (avatar cosmetics on profiles)
67. Activity streaks

## Smart Workout & Weather
68. Multi‑factor smart‑workout suggestion (`utils/smartWorkout.js`)
69. Google **Weather API** — temp, feels‑like, humidity, wind, UV, precipitation, cloud
70. Google **Air Quality API** — Universal AQI (0–100, higher = cleaner)
71. 0–100 conditions score (Great / Good / Fair / Poor) with a per‑factor traffic‑light breakdown
72. AC ratio > 1.3 overrides any suggestion to **recovery**
73. Recommended activity chips + collapsible card

## AI Chatbot
74. In‑app AI chat (`AIChatScreen`) — calls OpenAI directly from the device
75. Injury AI advice reuses the same text model
76. In‑memory chat history (resets on leaving the screen)

## Coach ML Analytics & Forecast (Python service)
77. **PMC** chart — Fitness / Fatigue / Form, from `react-native-svg`
78. **ACWR safe‑zone** chart — shaded 0.8–1.3 band
79. **Monthly forecast** — per‑trainee regression projecting acute load + AC ratio + risk
80. Forecast **history** dropdown (past months read‑only via `MonthlyForecasts`)
81. Injury‑risk classifier (pickle model with a rule‑based fallback)
82. Service mirrors the C# load formula exactly so numbers line up with the app
83. Gradeable Jupyter notebook (cleaning, EDA, regression + classification metrics, KMeans)

## Notifications
84. Load‑aware **daily reminder** (18:00) with Duolingo‑style escalation tiers
85. Workout **warning push** on confirm (Yellow / Red zones only)
86. Social pushes — friend requests / accepted friends / coach offers
87. Messages unread push (fires when the total unread count rises)
88. Push‑token plumbing (FCM) + in‑app banner for foreground events

## Theme & UX
89. Light / dark **theming** — runtime‑swappable palette across every screen (`useThemedStyles`)
90. Week‑start setting — single source of truth for the rolling charts
91. Onboarding overlay for first‑time users
92. Tap‑outside‑to‑dismiss everywhere; themed date/time picker
93. App logo, splash screen, notification silhouette icon

## Backend Cross‑Cutting
94. Three‑layer architecture — `Controllers → BL → DAL → DBservice`
95. Raw ADO.NET over **stored procedures** (no EF Core)
96. 22 REST controllers under `api/[controller]`
97. Core **training‑load algorithm** in `BL/LoadCalculationBL.cs` (acute, chronic, AC ratio, warning level)
98. Static file serving for uploaded images
99. Swagger / OpenAPI explorer (development only)
100. Seeded reference data + 13 dated migration scripts

## External Services & Integrations
> Each row is one external dependency.

101. Azure App Service — hosts the C# API
102. Azure SQL Database — primary datastore (`TrainWiseDB`)
103. Google Maps SDK — map rendering + routes
104. Google Weather API — weather factors (separate SKU)
105. Google Air Quality API — AQI factor (separate SKU)
106. OpenAI — in‑app AI chat + injury advice
107. Firebase Cloud Messaging — push notifications
108. Google Health Connect — workout import (Android)
109. Google Sign‑In / OAuth — social login

---

## Planned / Not yet implemented

Empty placeholders for future work — present in comparable projects, **not** built in TrainWise today:

- **CI/CD** — GitHub Actions build + test on PRs, gated deploy on merge (today: manual publish from VS 2022)
- **Secret scanning** — `gitleaks` pre‑commit hook + CI scan (today: manual safe‑push checklist)
- **Static analysis** — CodeQL + `npm audit` / `dotnet list package --vulnerable` gates
- **Cloud ML** — deploy the Python service to Azure so the coach forecast works without the PC
- **iOS app** — the Expo iOS shell is unmaintained (Android only)
- **Hardened auth** — salted password hashing + token‑based sessions + rate limiting
- **Content‑safety moderation** — screening of user‑generated text / images
- **Web / PWA client** — TrainWise is native‑only
- **Persistent AI chat history** — currently in‑memory per screen visit
