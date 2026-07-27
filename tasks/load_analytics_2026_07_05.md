# Load Analytics: rolling + EWMA trend charts (2026-07-05)

Trainee Load tab + coach detail get a day-by-day AC-ratio trend with a method
toggle (Classic rolling / Smooth EWMA), weekly volume, intensity mix and
variety (monotony). C# backend is the source of truth; the app falls back to
an on-device mirror when the endpoint is unreachable.

## What was built

### Backend (C#)
- `Models/LoadAnalytics.cs` — NEW: `LoadAnalytics` / `LoadSeriesPoint` / `LoadSummary`.
- `BL/LoadAnalyticsBL.cs` — NEW: 56-day series, every point carries BOTH
  methods:
  - rolling coupled ACWR (Gabbett 2016): acute 7d sum, chronic 28d sum / 4
  - bias-corrected EWMA (Williams 2017; correction per Kingma & Ba 2015):
    lambda = 2/(N+1) → 0.25 / 0.069, corrected by 1-(1-λ)^t, t from first log.
    Without the correction a new user's first workout falsely reads Red.
  - cold-start floors pre-baseline (rolling: 150/280/420 weekly; EWMA: /7)
  - summary: Foster monotony/strain, intensity mix (RPE 1-3/4-6/7-10,
    duration-weighted), active days, rest days.
- `BL/LoadCalculationBL.cs` — `DetermineLoadLevel` + `GetBootstrapAcuteLoad`
  changed private → `internal static` (shared with analytics; no behavior change).
- `DAL/DailyLoadDAL.cs` — `GetActivityLogsForRange` (reuses
  `sp_GetActivityLogsForLoad` with a wide window — **NO SQL migration needed**).
- `Controllers/DailyLoadController.cs` —
  `GET api/dailyload/user/{id}/analytics?days=56&end=YYYY-MM-DD`,
  gated `CallerOwnsOrCoaches` (trainee or linked coach). `end` = device-local
  date (Azure runs UTC; fixes the 00:00-03:00 Israel lag).

### Frontend (Expo)
- `src/components/AcwrTrendChart.js` — NEW custom SVG chart: green sweet-spot
  band 0.8-1.3, red tint above, dashed 1.5 line, thresholds on the Y axis,
  plain-language zone labels, today-dot colored by level with value bubble.
- `src/components/LoadAnalyticsSection.js` — NEW: "Load Trend" card (Classic /
  Smooth toggle persisted at `@trainwise_acwr_method`, today readout + level
  pill + week delta, baseline note) and "Training Analysis" card (8-week volume
  bars + ramp warning >20%, intensity mix vs ~70/10/20, variety row with rest
  days), help modals. Self-measures width (`onLayout`) so it fits both hosts.
- `src/utils/loadSeries.js` — NEW on-device mirror of LoadAnalyticsBL (same
  camelCase shape) used when the endpoint 404s / offline. KEEP IN SYNC.
- `src/services/api.js` — `getLoadAnalytics(userId, days)`.
- `src/screens/WarningsDashboardScreen.js` — section inserted after the weekly
  chart card.
- `src/screens/CoachTraineeDetailScreen.js` — foldable "Load trend & analysis"
  card (collapsed by default, only fetches when opened), after the per-day week
  chart.

### Verified
- `dotnet build`: 0 errors.
- eslint on all touched JS: clean.
- Math checked by running the real `loadSeries.js` in Node:
  - steady 2x/week (75+360) Regular → rolling 1.00 Yellow, EWMA 1.22 Yellow
  - 4-day 400/day spike → both Red (2.44 / 2.12)
  - new user, one 360 workout → rolling 1.29 Yellow, EWMA 0.89 (was 1.69 RED
    before the bias correction)

## Deploy checklist
1. **No SQL migration.**
2. **Publish the C# backend** to Azure (VS 2022 → Publish). Until published,
   the app silently uses the on-device fallback — charts still work.
3. **Rebuild + sideload the APK** (JS + no new native deps: react-native-svg
   was already in package.json, so Metro reload is enough for dev testing;
   APK rebuild to distribute).
4. Smoke test: Load tab → Load Trend card renders, toggle switches Classic ↔
   Smooth instantly, help modal opens; coach → trainee → fold open "Load trend
   & analysis" shows the same numbers.

## Notes / open questions
- Official status (Current Status card, coach status, recommendations) stays
  on Classic — the toggle changes the ANALYSIS view only, so trainee and coach
  always agree on the official number.
- Existing semantic quirk (unchanged, worth a decision later): the app calls
  0.8-1.3 "Yellow / watch it" while the literature calls that band the sweet
  spot. The chart shows the band green; the level pill still follows the app's
  Yellow semantics.
