# Device-test refinements round 2 — 2026-06-21 (14 items)

Mostly JS. One backend file (PushSender icon/color). Native res changes for app
name, splash, and the notification icon → this round needs a **full native
rebuild** (not the fast JS-only one), because android/ res + manifest changed.

## Deploy
1. C# Publish (only `BL/PushSender.cs` changed this round — sets FCM small icon).
2. Rebuild APK (native — res/manifest changed):
   ```
   cd C:\Dev\TrainWise\TrainWiseExpo\android
   $env:NODE_OPTIONS = "--max-old-space-size=8192"
   .\gradlew assembleRelease --no-parallel
   ```
   (No SQL this round.)

## Items
1. **Home scroll-to-top** — tapping the Home tab again scrolls to top (`useScrollToTop` on the Home ScrollView).
2. **Map icons** — smaller (38–40px), center-anchored, calmer orange; less cluttered.
3. **AddWorkout block** — tightened the live timer/START card padding.
4. **Smart suggestion moved to Home** — new `components/SmartSuggestionCard.js` (foldable, weather + AC ratio, activity icons on suggested chips, tap → AddWorkout). Removed from AddWorkout (no longer fetched there).
5. **Board: choose workout** — "Choose a workout to share" opens a picker of recent confirmed logs; selecting prefills title/metric.
6. **Tap-outside dismiss** — AddWorkout exertion modal, Board create + chooser modals, Calendar add/edit + complete modals now close on backdrop tap (Pressable backdrop + inner Pressable). (Connect already did.)
7. **Calendar tap-date-to-add** — tapping the already-selected day opens the add sheet; the + button still works.
8. **Connect filter → map pins** — gyms view shows only gym pins, trainees → trainee pins, coaches → coach pins. User pin icon is the same person glyph regardless of the viewer's role.
9. **Sizing** — active-injury row/button more compact; Health Connect screen wrapped in SafeAreaView (top inset) + trimmed header padding so the title isn't crammed under the status bar.
10. **AC ratio mismatch FIXED** — coach saw 1.85, trainee 0.6. Cause: the trainee's Warnings applies a cold-start chronic floor (beginner 150 → 90/150 = 0.6) that the server's stored DailyLoad doesn't (90/48.6 = 1.85). New `utils/acwr.js` replicates the trainee's exact client formula; CoachDashboard now computes each trainee's ratio from their confirmed ActivityLogs → matches the trainee. (Exact for beginners / once a real baseline exists; experienceLevel defaults to the 150 floor when the summary omits it.)
11. **Calendar inputs visible + badge** — plan/complete sheets now lift above the keyboard via a Keyboard-height listener (deterministic on Android, where the old KeyboardAvoidingView did nothing). Coach-planned workouts show a red badge on the Home calendar icon (counted in HomeScreen from unseen coach plans; cleared when the trainee opens the calendar).
12. **App name + notification icon** — app label is now **TrainWise** (`strings.xml` + app.json name). Notification small icon was a white "block" because Android requires a white-on-transparent silhouette; added `res/drawable/ic_notification.xml` (white heartbeat vector) + manifest meta-data for FCM and expo-notifications + `notification_color` + set Icon/Color on the FCM push. The large icon in the shade remains the round app icon.
13. **Route map** — INVESTIGATED, not a bug. The code path is correct: routes are pulled from Health Connect on view and need (a) a workout that actually recorded GPS and (b) the per-record consent prompt. Manual logs / indoor / non-GPS Samsung sessions legitimately return `no_data` → "No route recorded." To see a route: sync a real outdoor run that has GPS and accept the route-access prompt.
14. **Splash** — replaced the Expo crosshair `splashscreen_logo.png` (all densities) with the app logo (wowowow.png) and set `splashscreen_background` to navy #13173d.

## Note
- AddWorkout still contains the now-unused `loadSmartSuggestion` function + smart-card JSX (never rendered since it's no longer called). Harmless dead code; can be deleted later.
