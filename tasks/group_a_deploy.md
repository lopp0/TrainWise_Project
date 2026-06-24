# Group A — deploy checklist (built 2026-06-19)

Group A (A-1…A-6) is new features (not a reversible design experiment like Group
B). Everything is additive. To make it live you must (1) run the SQL migrations,
(2) Publish the C# backend, (3) rebuild the APK.

## 1. SQL migrations — run on BOTH local SQL Express (`TrainWise`) AND Azure SQL
Run in this order (all idempotent, safe to re-run). SSMS → open file → Execute.

| Order | File | Adds |
|---|---|---|
| 1 | `sql/2026-06-19_add_records.sql` | `PersonalRecords`, `EarnedBadges` (A-5) |
| 2 | `sql/2026-06-19_add_cosmetics.sql` | `Users.EquippedBadge/Title/Frame` + `sp_LoginUser` (adds cols) + `sp_UpdateEquippedItems` (A-1) |
| 3 | `sql/2026-06-19_add_live_location.sql` | `Users.ShareLiveLocation` + `sp_GetNearbyUsers` (gates coords) + `sp_SetShareLiveLocation` (A-2) |
| 4 | `sql/2026-06-19_add_workout_board.sql` | `Users.Country`, `Users.IsOnLeaderboard`, `WorkoutPosts`, `WorkoutPostLikes` (A-3) |
| 5 | `sql/2026-06-19_add_calendar.sql` | `PlannedWorkouts` (A-4) |

(`sql/2026-06-18_add_injury_link.sql` from Group B's B-7 also still needs running if you haven't.)

## 2. C# backend — Publish from VS2022 (right-click TrainWise → Publish)
New files:
- Models: `RecordsModels.cs`, `BoardModels.cs`, `CalendarModels.cs`
- DAL: `RecordsDAL.cs`, `BoardDAL.cs`, `CalendarDAL.cs`
- BL: `RecordsBL.cs`, `BoardBL.cs`, `CalendarBL.cs`
- Controllers: `RecordsController.cs`, `WorkoutBoardController.cs`, `CalendarController.cs`

Changed files:
- `Models/User.cs` (+EquippedBadge/Title/Frame, +UserCosmetics), `Models/SocialModels.cs` (+ShareLiveLocation on NearbyUser, +ShareLocationRequest)
- `DAL/UserDAL.cs` (read cosmetics + UpdateEquippedItems + GetCosmeticsForUsers), `DAL/SocialDAL.cs` (ShareLiveLocation read + SetShareLiveLocation)
- `BL/UserBL.cs` (UpdateEquipped/GetCosmetics), `BL/SocialBL.cs` (SetShareLiveLocation)
- `Controllers/UsersController.cs` (PUT /equip, GET /cosmetics, EquipRequest), `Controllers/SocialController.cs` (PUT /sharelocation)

New endpoints: `GET/POST /api/records...`, `PUT /api/users/{id}/equip`, `GET /api/users/cosmetics`, `PUT /api/social/sharelocation/{id}`, `GET/POST/DELETE /api/board...`, `GET/PUT/DELETE /api/calendar...`.

## 3. APK rebuild
No new native deps in Group A, so plain gradle is fine (use `./gradlew`, NOT `expo run:android` — preserves the Health Connect manifest):
```
cd TrainWiseExpo/android && NODE_OPTIONS=--max-old-space-size=8192 ./gradlew clean assembleRelease --no-parallel
```

## Per-feature summary
- **A-5 Records/Badges**: server evaluates records + 18 badges from confirmed logs. Checked after every workout (AddWorkout submit + HC sync) → celebratory alert + coin reward. New `PersonalRecordsScreen` (Home header streak chip opens it).
- **A-1 Cosmetics**: equipped badge/title/frame (client `SHOP_ITEMS` string ids) stored on `Users`; ShopScreen pushes on equip; `UserProfileCard` + upgraded `Avatar` render frame/badge/title; shown in Connect list + mini-profile sheet (batch-fetched via `/users/cosmetics`).
- **A-2 Live location**: Settings "Share my live location" toggle (default off, double opt-in); `SocialContext` pushes GPS in the 60s heartbeat when on; nearby SP nulls non-sharers' coords.
- **A-6 Map markers**: opted-in users appear as map pins (gyms always); "Live users" filter toggle; "Invite to workout" on a friend's sheet.
- **A-3 Board/Leaderboard**: `WorkoutBoardScreen` (feed + like + add-friend + share modal) and `LeaderboardScreen` (4 metrics, medals, opt-in); reached via a `ConnectTabs` segmented control (Map/Board/Ranks).
- **A-4 Calendar**: `TrainingCalendarScreen` (week nav, day cards, add/edit/complete) opened from the Home header calendar icon; coaches open a trainee's plan from `CoachTraineeDetailScreen` → "Training plan".

## Scoping decisions / deviations (vs the prompt's suggestions)
- Cosmetic equipped ids are STORED AS STRINGS (the client catalog ids like `frame_gold`), not the doc's INT FK — matches the existing AsyncStorage shop. No `ShopItems`/`UserOwnedItems` server tables (shop stays client-side; only the equipped ids are persisted for others to see).
- A-2 opt-out keeps stored coords (so you stay in proximity LISTS) but the SP stops exposing them to the map — cleaner than nulling coords which would drop you from lists too.
- A-6 user pins use expo-maps' simple marker API (title/snippet/id) — it can't render custom avatar/pulse pins, so gym-vs-user is by snippet + id-prefix routing.
- A-3 feed/leaderboard filter by Country, which defaults to `'IL'` (signup doesn't collect a country; demo is Israel). `IsOnLeaderboard` defaults to 1 (opt-OUT) so the board has data for the demo.
- A-3 Connect tabs use tap-navigation between three screens (not finger-swipe) for reliability.
- A-1 cosmetics integrated into ConnectScreen list + sheet; `MyCoachScreen`/`RequestsScreen` can adopt `UserProfileCard` too but weren't rewritten.
- A-4 coach "auto build week from AC ratio" not implemented — coach plans manually. "Smart match on log" (link a logged workout to a planned one) not wired.
