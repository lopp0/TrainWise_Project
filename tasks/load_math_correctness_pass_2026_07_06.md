# TrainWise — Load-Math Correctness Pass (2026-07-06)

**Handoff / resume document.** Everything modified in the load-algorithm correctness
review + fix session. Self-contained so it can be pasted into a fresh conversation.

- **Branch:** `Lirone's-Branch`
- **Verification:** C# solution builds (0 errors, 162 pre-existing nullable warnings);
  new `TrainWise.Tests` xUnit project passes **18/18**; a Python script re-ran the same
  V1–V6 vectors against `ml/features.py` + `ml/risk.py` — every number matches C# exactly.
- **Deploy:** C# Publish + APK rebuild + restart `ml/app.py`. **NO SQL migration.**
- **User decisions locked in this session:** B5 = timezone param option (a); B9 = covered-days
  ramp; B8 = leave JS chronic-based (already was).

---

## 0. Why this was done

The training-load math (acute load, chronic load, AC ratio, Green/Yellow/Red) is the app's
safety-critical feature. The SAME formula was implemented on **8 surfaces** and they had
drifted apart, so the stored status, the trainee's Warnings screen, the coach ML charts, and
the offline fallback could all disagree for the same user. A wrong number = a real athlete
falsely reassured (missed injury risk) or falsely alarmed.

### The 8 load-math surfaces (change one → change all)

| # | Surface | File | Role |
|---|---|---|---|
| 1 | `LoadCalculationBL.CalculateAndSave` | `TrainWise/TrainWise/BL/LoadCalculationBL.cs` | Stored `DailyLoad` row (official status/recommendations) |
| 2 | `LoadAnalyticsBL` | `TrainWise/TrainWise/BL/LoadAnalyticsBL.cs` | `/analytics` rolling + EWMA trend series |
| 3 | `ml/features.py` `rolling_loads` / `level_for` | `ml/features.py` | Coach PMC + ACWR charts, forecast base |
| 4 | `ml/risk.py` `rule_class` | `ml/risk.py` | Risk fallback classifier |
| 5 | `ml/forecast.py` | `ml/forecast.py` | Monthly forecast regression |
| 6 | `utils/acwr.js` `computeACWR` | `TrainWiseExpo/src/utils/acwr.js` | Coach dashboard / weekly-delta |
| 7 | `utils/loadSeries.js` `computeLoadAnalytics` | `TrainWiseExpo/src/utils/loadSeries.js` | On-device fallback for `/analytics` |
| 8 | `WarningsDashboardScreen` inline math | `TrainWiseExpo/src/screens/WarningsDashboardScreen.js` | Trainee Warnings dashboard (does NOT use acwr.js) |

**Key discovery:** the review brief assumed 3 surfaces; there are 8. In particular the
Warnings screen has its own inline copy of the load math (not `utils/acwr.js`), and there is
no backend test project (the solution had 1 project, no tests).

---

## 1. The discrepancies found (the "before" state)

Labels B1–B9 / E1–E5 are used throughout the code comments and commit rationale.

| # | Bug | Severity | Who diverged |
|---|---|---|---|
| **B1** | Unconfirmed HC imports counted in load. `sp_GetActivityLogsForLoad` has NO `IsConfirmed` filter and the DAL didn't even map the column; HC sync posts `isConfirmed:false`. Both C# surfaces counted pending imports; Python + all 4 JS surfaces excluded them. | HIGH | C#-1, C#-2 |
| **B2** | Cold-start floor used the one-shot `Users.IsBaselineEstablished` flag (set once, never resets) in C#-1 + Python, but a dynamic ≥7-active-days rule in C#-2 + JS. A returning-from-layoff athlete got a false Red stored while the app showed Green. | HIGH | C#-1, Python |
| **B3** | Injured-band gap: `DetermineLoadLevel` injured branch was Red ≥1.2 / Yellow 0.8–1.1 / else Green, so an injured user at 1.15 read **Green** while a healthy user read Yellow. | Medium | C#-1, C#-2, loadSeries.js |
| **B4** | Injured tightening missing entirely in Python `level_for`/`rule_class` and in acwr.js/Warnings (healthy bands for everyone). | Medium | Python, acwr.js, Warnings |
| **B5** | Day bucketing timezone: `loadSeries.js` bucketed by LOCAL day; every other surface by UTC day. A 00:30 Israel workout landed on the previous day in 7 of 8 surfaces. | Medium | all except loadSeries.js |
| **B6** | Midnight edge in C#-1: SP uses `StartTime <= @EndDate` with `EndDate = date+1 00:00:00`, so a session at exactly next-day midnight counted into today. | Low | C#-1 |
| **B7** | Python `acwr_series` rounded the ratio to 2dp THEN graded the level (1.3049 → 1.30 → Yellow instead of Red). | Low | Python |
| **B8** | Stress-score denominator: C#-1 uses `baseline×7`; JS uses `chronic`. Different metrics, same name. | Low (display) | JS vs C# |
| **B9** | Partial-history chronic inflation (shared by all 8, consistently): the `/4` divisor assumes a full 28-day window. A steady new user reads ratio ≈2.0 (false Red) for weeks 2–3 once the floor lifts. | HIGH impact, consistent | all 8 |
| **E1** | `forecast.py` poly2 guard illusory at n=3: a degree-2 poly through 3 points always fits exactly (R²=1), so the "clear improvement" check always passed → noise extrapolated. | — | forecast.py |
| **E5** | `forecast.py` short final bucket (days 29–31 = 3 days) dragged the linear fit down because it fit raw bucket totals, not per-day rate. | — | forecast.py |

### User decisions on the ambiguous ones
- **B5 → option (a):** clients pass `tzOffsetMinutes`; servers shift `StartTime` before
  day-bucketing so all surfaces agree on the user's LOCAL calendar day.
- **B9 → covered-days ramp** (my recommended option): see §2.
- **B8 → align JS to chronic-based:** already satisfied (acwr.js + Warnings were already
  chronic-based; the divergence was C#'s stored stress using the frozen baseline). **Left
  as-is, documented.**

---

## 2. The rules now enforced on EVERY surface

1. **Confirmed-only.** `IsConfirmed = 0` (pending HC imports) never count toward
   acute/chronic/ratio. `NULL` = confirmed (legacy rows). Matches the app's
   `(isConfirmed ?? IsConfirmed) !== false` skip rule.
2. **Dynamic cold-start floor.** Floor `chronic` at the experience bootstrap
   (Beginner 150 / Regular 280 / Advanced 420 weekly) whenever the trailing 28-day window has
   **< 7 days with load > 0** — NOT the never-resetting `Users.IsBaselineEstablished` flag.
3. **Covered-days ramp (B9 fix).** Once ≥ 7 active days:
   `chronic = sum28 / min(4, covered/7)`, where `covered` = days from the first loaded day
   inside the 28-day window through the current day (clamped 7..28).
   - A steady 2-week-old user: `sum28=1400`, covered=14 → `1400 / min(4, 2) = 700` → ratio
     `700/700 = 1.0` (Yellow), instead of the old `1400/4 = 350` → ratio 2.0 (false Red).
   - Full 28-day history unchanged (covered=28 → `/4`).
   - **EWMA needs NO ramp** — its bias correction already returns the sample mean over short
     history, so steady training reads ratio 1.0 already.
4. **Injured bands, no gap.** Red ≥ 1.2, Yellow `0.8 ≤ r < 1.2`, Green < 0.8. (Was Yellow
   0.8–1.1, leaving 1.1<r<1.2 falling through to Green.)
5. **Grade the UNROUNDED ratio.** 1.3049 is Red even though it displays as 1.30.
6. **Timezone bucketing.** Clients send `tzOffsetMinutes = -new Date().getTimezoneOffset()`
   (JS convention: `getTimezoneOffset` is minutes BEHIND UTC, so negate). Servers shift
   `StartTime` by that many minutes before taking `.Date`. `0` = legacy UTC-day behavior
   (old APKs keep working).

---

## 3. File-by-file changes

### C# backend

#### `TrainWise/TrainWise/DAL/DailyLoadDAL.cs`
- Both readers (`GetActivityLogsForLoad`, `GetActivityLogsForRange`) now map
  `IsConfirmed = reader["IsConfirmed"] as bool? ?? true` (NULL → confirmed). The SP already
  does `SELECT *`, so no SP change.
- `GetActivityLogsForLoad` widened its fetch window from `[-27, +1]` to `[-28, +2]` days so
  the tz shift can't drop a boundary row (out-of-window rows bucket to days the sums ignore).

#### `TrainWise/TrainWise/BL/LoadCalculationBL.cs`
- `CalculateAndSave(int userId, DateTime date, int tzOffsetMinutes = 0)` — new optional param.
- Replaced the inline acute/chronic LINQ + static-flag floor with the shared statics.
- Baseline-establish check now uses `CountActiveDays(...) >= 7` (load>0) instead of
  `sessions.Select(s => s.StartTime.Date).Distinct().Count() >= 7`.
- Injured branch of `DetermineLoadLevel`: Yellow now `ratio >= 0.8` (was `>= 0.8 && <= 1.1`).
- **New internal statics (single source of truth, exercised by the tests):**
  - `BucketByLocalDay(sessions, tzOffsetMinutes)` — skips `!IsConfirmed`, shifts by tz
    (clamped ±14h), buckets to `.Date`, sums same-day.
  - `SumRange(loadByDay, start, end)` — inclusive day-loop sum.
  - `CountActiveDays(loadByDay, start, end)` — count of days with load > 0.
  - `EffectiveChronic(loadByDay, day, bootstrapWeekly)` — the floor + ramp logic from §2.
  - `DetermineLoadLevel` and `GetBootstrapAcuteLoad` were already `internal static`.

#### `TrainWise/TrainWise/BL/LoadAnalyticsBL.cs`
- `GetAnalytics(userId, days, end, int tzOffsetMinutes = 0)` — new param, clamped ±14h.
- Fetch window widened one extra day each side (`fetchFrom.AddDays(-1)`, `to.AddDays(2)`).
- Bucketing delegated to `LoadCalculationBL.BucketByLocalDay` (was an inline UTC-day loop).
- Rolling chronic now `LoadCalculationBL.EffectiveChronic(...)` (was `SumRange/4` + inline
  floor). EWMA chronic keeps just the floor (no ramp), by design.
- Deleted its private `SumRange`/`CountActiveDays` (now uses the shared statics).
- `BuildSummary` takes `tzOffsetMinutes`; intensity-mix loop skips `!IsConfirmed` and shifts
  by tz before the 28-day cutoff compare.

#### `TrainWise/TrainWise/Controllers/DailyLoadController.cs`
- `GetAnalytics` gained `[FromQuery] int tzOffsetMinutes = 0`, passed through.
- `CalculateAndSave` passes `request.TzOffsetMinutes`.
- `DateRequest` DTO gained `public int TzOffsetMinutes { get; set; } = 0;` (optional, so old
  APKs keep working; 0 = legacy UTC-day bucketing).

#### `TrainWise/TrainWise/TrainWise.csproj`
- Added `<InternalsVisibleTo Include="TrainWise.Tests" />` so the tests can reach the
  internal statics.

### Python ML service

#### `ml/features.py`
- `get_trainee_logs(trainee_id, since, tz_offset_minutes=0)` — shifts `StartTime` by tz
  (clamped ±14h), fetches one extra day back so the shift can't drop boundary rows.
- `rolling_loads(daily, experience_level, baseline_established=None)` — **fully rewritten** to
  mirror `EffectiveChronic`: vectorized numpy for the < 7-active-days floor vs the
  covered-days ramp. `baseline_established` kept for signature compat but **ignored** (the
  per-day dynamic rule replaces the flag). Uses `np.searchsorted` to find the first loaded day
  per window for the ramp divisor.
- `level_for(ratio, has_active_injury=False)` — gained the injured bands (Red ≥1.2, Yellow
  0.8–<1.2).
- New `count_active_injuries(trainee_id)` helper.
- `_loads_window`, `pmc_series`, `acwr_series` thread `tz_offset_minutes`.
- `acwr_series` grades the level from the UNROUNDED ratio (B7) and passes the injury flag.

#### `ml/risk.py`
- `rule_class(ac_ratio, has_active_injury=False)` — injured tightening (High ≥1.2).
- `classify(...)` derives `has_injury` from `features["active_injuries"]` and passes it to the
  rule fallback.

#### `ml/forecast.py`
- `_predict_weekly_loads`: fits on **per-day rate ×7** (`load / bucket_days * 7`) instead of
  raw bucket totals, so a short 1–3 day final month bucket doesn't drag the trend (E5). Poly2
  upgrade now requires **n ≥ 4** (was n ≥ 3, where a parabola always fit exactly) (E1).
- `_simulate_forward(..., has_injury=False)`, `_state_from_rolled(..., has_injury=False)`:
  grade/risk from the unrounded ratio + injury flag. Both now call
  `features.rolling_loads(daily, user["ExperienceLevel"])` (dropped the ignored flag arg).
- `get_forecast(trainee_id, month_key=None, tz_offset_minutes=0)`: computes
  `active_injuries` / `has_injury` up front, threads tz into `get_trainee_logs`, passes
  `has_injury` through the simulate/state calls. Removed the late duplicate injury count.

#### `ml/app.py`
- New `_tz_offset()` reads `?tzOffsetMinutes=` (clamped ±14h). `pmc`, `acwr`, and `forecast`
  endpoints pass it through.

### React Native frontend

#### `TrainWiseExpo/src/utils/loadSeries.js`
- Injured Yellow band fixed to `>= 0.8` (removed the `<= 1.1` cap) (B3).
- New `effectiveChronic(day, bootstrapWeekly)` closure mirroring `EffectiveChronic`; rolling
  chronic now uses it. EWMA chronic keeps just the floor (no ramp).

#### `TrainWiseExpo/src/utils/acwr.js` (rewritten)
- `parseServerDate` for session times (was naive `new Date`, bucketing 00:30 workouts a day
  early) (B5).
- Cold-start floor counts days with **load > 0** (was any session day).
- Covered-days ramp once ≥ 7 active days (B9). `coverEnd = min(weekEnd, now)`.
- `computeACWR(logsRaw, experienceLevel, weekOffset=0, hasActiveInjury=false)` — new 4th
  param; `determineLevel` gained injured bands.
- NOTE: acute stays the **calendar-week** sum (week-to-date) — this is intentional for the
  per-week coach/Warnings view (per lessons 2026-04-21/26), not a bug.

#### `TrainWiseExpo/src/screens/WarningsDashboardScreen.js`
- Imports `parseServerDate`; all three `new Date(log.startTime...)` sites switched to it
  (weekly-bar bucketing, `sumSessionLoadsInRange`, the day-loads map) (B5).
- `determineLoadLevel(ratio, hasInjury=false)` — injured bands.
- Cold-start floor + covered-days ramp inline (mirrors `EffectiveChronic`), counting load>0
  days and using the first loaded day for the ramp divisor (B9).
- Passes `hasActiveInjury` (already fetched via `getActiveInjuriesByUser`) into the level
  calls; added `hasActiveInjury` to the `renderWeek` `useEffect` deps.

#### `TrainWiseExpo/src/services/api.js`
- New `deviceTzOffsetMinutes()` = `-new Date().getTimezoneOffset()`.
- `calculateDailyLoad` sends `tzOffsetMinutes` in the POST body.
- `getLoadAnalytics` sends `tzOffsetMinutes` in the query params (alongside the existing
  `end` device-date param).

#### `TrainWiseExpo/src/services/mlApi.js`
- New `tzOffsetMinutes()` helper; `getTraineePMC`, `getTraineeACWR`, `getTraineeForecast` all
  send `tzOffsetMinutes` in their params.

### Tests (new)

#### `TrainWise/TrainWise.Tests/` (new xUnit project, added to `TrainWise.sln`)
- `TrainWise.Tests.csproj` (net8.0, references the API project).
- `LoadMathTests.cs` — 18 tests over the hand-computed vectors:
  - **V1** new beginner, one 300 workout → chronic floored 150 → ratio 2.0 Red.
  - **V2** same but `IsConfirmed=false` → not counted (empty bucket).
  - **V3** steady 100/day × 14 → chronic 700 (ramp /2) → ratio 1.0 Yellow (not false Red).
  - **V3b** steady × 7 days → chronic 700 (ramp /1). **V3c** full 28 days → chronic 700 (/4,
    unchanged).
  - **V4** advanced, 25-day layoff + comeback 300 → dynamic floor re-arms at 420 → 0.71 Green.
  - **V5** 00:30 Israel workout (21:30 UTC prev day): tz 0 → prev day, tz 180 → local day.
    **V5b** exact-midnight session buckets to its own day (midnight-edge fix).
  - **V6** level bands `[Theory]` incl. injured 1.15/1.19 → Yellow, 1.20 → Red. **V6b** null
    → Green. Same-day summing + NULL-confirmed mapping.

### Docs
- `CLAUDE.md` updated: repo-layout note (TrainWise.Tests), the "Load analytics" section (new
  §2 rules + `tzOffsetMinutes`), "ActivityLog invariants" (injured tightening, confirmed-only),
  and the ML service description. **`docs/` suite lives only on `main` branch** — the
  `docs/features.md` API-surface entry for the new `tzOffsetMinutes` params still needs a sync
  at the next main-branch docs pass.

---

## 4. Verification performed

- `dotnet build` from `TrainWise/` → 0 errors (162 pre-existing nullable warnings).
- `dotnet test --no-build` → **Passed: 18, Failed: 0**.
- Python: a scratch script (`check_py_mirror.py`) rebuilt the V1/V3/V3b/V3c/V4 series and the
  V6 band cases against `ml/features.py` + `ml/risk.py` → **ALL OK** (chronic/ratio identical
  to C# to 1e-6; V4 ratio 0.714285…).
- Python: `import app, forecast, features, risk` → clean.

---

## 5. Deploy checklist

1. **C# Publish** (VS 2022 → right-click TrainWise → Publish → existing Azure profile).
2. **APK rebuild** — `cd TrainWiseExpo/android && ./gradlew assembleRelease` (or
   `npx expo run:android --variant release`); verify the APK timestamp/size CHANGED. This is a
   JS-only frontend change, so a Metro reload works in dev; a fresh APK is needed to ship.
3. **Restart `ml/app.py`** (`cd ml && venv\Scripts\activate && python app.py`) so the Python
   edits take effect — only affects the coach analytics/forecast screen.
4. **NO SQL migration.**

### Expected behavior change (tell the user)
Numbers will visibly shift for users with **< 28 days of history** (no more false Red in weeks
2–3) and anywhere **pending HC imports** were inflating the stored status. This is the intended
correction, not a regression.

---

## 6. Known / intentionally-left items

- **B8 stress-score split:** C# stored stress uses `baseline×7`; JS uses `chronic`. Per user's
  decision (align JS to chronic-based = already true), left as-is and documented. The C#
  stored `StressScore` is a display-only field and was not changed.
- **forecast.py n=2:** reports a meaningless `R²=1.0` (an exact line through 2 points). Values
  are fine (clamped); metadata overstates certainty. Cosmetic, not fixed.
- **acwr.js acute = calendar-week (week-to-date):** intentional for the per-week view; means
  early in a week the acute is only the elapsed days (Monday reads Green even after a brutal
  previous week). Documented, not a bug.
- **docs/features.md** (on `main`) API-surface entry for `tzOffsetMinutes` not yet synced.
- **git:** `appsettings.json` shows modified — that's the pre-existing local Azure-password
  working copy, untouched. Keep it unstaged (`git restore --staged` it) per the safe-push rule.

---

## 7. Files touched (quick list)

```
TrainWise/TrainWise/DAL/DailyLoadDAL.cs
TrainWise/TrainWise/BL/LoadCalculationBL.cs
TrainWise/TrainWise/BL/LoadAnalyticsBL.cs
TrainWise/TrainWise/Controllers/DailyLoadController.cs
TrainWise/TrainWise/TrainWise.csproj
TrainWise/TrainWise.sln                         (added test project)
TrainWise/TrainWise.Tests/TrainWise.Tests.csproj   (new)
TrainWise/TrainWise.Tests/LoadMathTests.cs          (new)
ml/features.py
ml/risk.py
ml/forecast.py
ml/app.py
TrainWiseExpo/src/utils/loadSeries.js
TrainWiseExpo/src/utils/acwr.js
TrainWiseExpo/src/screens/WarningsDashboardScreen.js
TrainWiseExpo/src/services/api.js
TrainWiseExpo/src/services/mlApi.js
CLAUDE.md
```
