# App — Expo (React Native) Mobile App

Part of the Waqt prayer tracker project. See `../CLAUDE.md` at the project root for overall context, day-by-day history, and cross-cutting conventions — this file goes deeper on frontend-specific implementation detail.

**Note:** this replaces the auto-generated Expo template `CLAUDE.md`/`AGENTS.md` stubs that `create-expo-app` creates by default — those are generic boilerplate, not project-specific.

## Stack

- Expo SDK **54** (React Native 0.81, React 19.1.0) — **pinned deliberately**, matches the Expo Go app on the App Store. Don't casually upgrade the SDK version without checking Expo Go's current published version first, or `expo start` will refuse to connect to physical devices via QR code.
- `expo-router` (file-based routing) — **critical**: every file under `app/` is treated as a real navigable route. Test files must never live there (see gotcha below).
- TypeScript, strict mode
- Jest + `jest-expo` preset + `@testing-library/react-native` v14

## ⚠️ Critical gotchas

1. **Never put `.test.tsx`/`.test.ts` files inside `app/`.** This shipped a real bug once (Day 12): `app/history.test.tsx` was picked up by expo-router and appeared as an actual `/history.test` screen in the production web export. Test files belong in `app/__tests__/` (a sibling directory, not nested under any route folder) or co-located next to the source file _outside_ the `app/` tree (e.g. `lib/foo.ts` + `lib/foo.test.ts` is fine, since `lib/` isn't a route folder).
2. **`@testing-library/react-native` v14 made `render`/`fireEvent`/`act` async.** Every call needs `await`, or you get a confusing "render function has not been called" error with no useful stack trace. This was a real debugging session (Day 8) — don't relearn it.
3. **`EXPO_PUBLIC_API_BASE_URL` and `127.0.0.1`**: the default (`http://127.0.0.1:8000`) only works from a web browser or iOS Simulator on the same machine as the Django server. A physical phone via Expo Go needs the computer's actual LAN IP (e.g. `192.168.1.23`) in a `.env` file — and a full `expo start` restart, since env vars are baked in at bundler startup, not hot-reloadable. Android Emulator needs `10.0.2.2` instead.
4. **SDK-54-compatible package versions aren't always the npm-latest version.** This sandbox's network couldn't resolve `npx expo install <package>` (it needs to reach Expo's registry, which isn't always allowed). When adding a new Expo-ecosystem package, check `node_modules/expo/bundledNativeModules.json` for the exact version Expo SDK 54 expects, or verify via `npm view <package> versions`, rather than trusting whatever `npm install <package>` (no version pin) resolves to.

## Directory structure

```
app/                          — routes (expo-router file-based)
  (tabs)/index.tsx            — solo home screen (today's prayers; now links to qada-setup and qada-tracker)
  history.tsx                 — calendar/history view
  day/[date].tsx              — day-detail screen (view/edit any past date)
  qada-setup.tsx               — Day 13: birth date / gender / bulugh age / practice-start date form
  qada-tracker.tsx             — Day 15: 5 per-prayer progress bars + 1 combined overall bar
  _layout.tsx                 — root Stack, registers all screens
  __tests__/                  — test files that would otherwise live under app/ but can't
components/prayer/            — ProgressRing, PrayerRow, MonthCalendar, LocationSetupBanner, QadaProgressBar
hooks/usePrayerDay.ts          — shared load/tap/persist logic (today AND day-detail screen both use this)
lib/
  api.ts                       — typed API client, Basic Auth support. Day 13 added `updateProfile()`; Day 15 added `listQadaDebt()`/`calculateQadaDebt()`; Day 16 added `logQadaPrayer()`.
  session.ts                   — device-session bootstrap (see root CLAUDE.md's auth warning)
  prayerLogSync.ts             — POST-vs-PATCH decision logic for marking a prayer
  calendar.ts                  — pure month-grid + completion logic, canonical date formatters
  prayerTimes.ts               — Aladhan API client
  location.ts                  — GPS permission + manual city/country fallback
  qadaSetup.ts                 — Day 13: pure validation for the qada setup form + bulugh-age suggestion
constants/theme.ts             — Brand palette (see color rule below)
```

## Color system (`constants/theme.ts`)

- `Brand.accent` — the ONE color for every "done" state across the whole app (progress ring fill, checkmarks, calendar "all done" cells). Never introduce a second "done" color.
- `Brand.streak` — reserved exclusively for streak/flame indicators. Not used anywhere yet (no streak UI built).
- `Brand.neutralStroke` — unmarked/none states. **Never red** — the spec's tone is explicitly "no guilt," not punitive.
- `Brand.prayerColors` (5-color day-arc palette: Fajr/Dhuhr/Asr/Maghrib/Isha each a distinct hue) — **landing-page-only**, used in the marketing hero section's day-arc visual. Do not use these in-app; per-prayer color-coding on the same screen was explicitly ruled out by the spec.

## Key architecture: `usePrayerDay` hook

`hooks/usePrayerDay.ts` is shared between `app/(tabs)/index.tsx` (today) and `app/day/[date].tsx` (any past date reached from the calendar) — it handles loading a day's logs, optimistic tap-to-mark updates, and rollback on failure. **Don't duplicate this logic in a new screen** — extend the hook instead if new behavior is needed, so both call sites stay in sync.

Two related bugs already fixed here, don't reintroduce:

- The optimistic placeholder's `date` field must use `lib/calendar.ts`'s `toISODate()` (local-timezone-safe), never `date.toISOString().slice(0,10)` (UTC — silently wrong near midnight in some timezones).
- `lib/session.ts`'s `getOrCreateSession()` has an in-flight-promise guard — multiple screens call it concurrently on mount, and without the guard, a fresh install could register two separate throwaway accounts.

## `app/history.tsx` specifics

- Uses `useFocusEffect` (from `expo-router`) to refetch logs every time the screen regains focus — without this, editing a day via `app/day/[date].tsx` and navigating back shows stale calendar colors (a real Day 12 bug).
- Tapping **today's** cell routes to the Home tab (`router.push('/')`), not to `/day/[date]` — today already has its own independent `usePrayerDay` instance on the Home tab, and opening a second one for the same date would let the two silently diverge.

## `app/qada-setup.tsx` specifics (Day 13)

- Collects `birth_date`, `gender`, `bulugh_age`, `practice_start_date` and PATCHes them onto the account's self profile via `api.updateProfile(session.profileId, values, auth)`. No new backend schema was needed — these fields already existed on `Profile` since the Day 7.5 reconciliation, just unused by any UI until now.
- On mount, fetches the existing profile via `api.listProfiles` and prefills the form (including the profile's `madhhab`, needed for the bulugh-age suggestion below) if values are already set — so revisiting the screen after initial setup shows current values rather than a blank form.
- **Bulugh age auto-suggestion**: per the spec ("default suggested by madhhab norms, editable"), picking a gender auto-fills a suggested bulugh age (`lib/qadaSetup.ts`'s `suggestBulughAge`) — Hanafi 12/9, Shafi-grouped 15/9 for male/female. Only auto-fills while the person hasn't typed their own value yet (`bulughAgeTouched` state) — once they've edited it by hand, switching gender again won't silently overwrite what they entered.
- Validation lives in `lib/qadaSetup.ts` (`validateQadaSetup`), not inline in the component, so it's unit-testable without rendering anything. It rejects: malformed dates, calendar-nonexistent dates (e.g. Feb 31 — `Date` would otherwise silently roll it over to March), non-integer/non-positive bulugh age, an unrecognized gender value, a birth date or practice-start date in the future, and a practice-start date before the birth date.
- Dates are entered as plain `YYYY-MM-DD` text fields rather than a native date picker — no date-picker library (`@react-native-community/datetimepicker` or similar) is installed, and per gotcha #4 above, adding one requires checking the SDK-54-compatible version rather than trusting an unpinned `npm install`. Revisit this as a UX improvement once such a package is added.
- Does **not** yet calculate or display qada debt — this screen only collects the calculation's inputs. `QadaDebt`/`QadaLog` (backend models) remain unwired to any API — that's Day 14/15.

## `app/qada-tracker.tsx` specifics (Day 15/16)

- Fetches `GET /api/qada-debt/` (all of the account's rows across all profiles), then filters client-side to `row.profile === session.profileId` — the endpoint itself returns everything the account owns (relevant once family mode has UI and one account has several profiles).
- **Auto-calculates on first visit**: if filtering leaves zero rows (a fresh qada setup that's never been calculated), the screen calls `api.calculateQadaDebt()` itself rather than showing empty bars — so completing Day 13's setup and opening the tracker "just works" without a separate manual trigger.
- A `400` from that auto-calculate attempt (qada setup incomplete) routes to a dedicated `needs-setup` state with a link back to `/qada-setup`, rather than a generic error banner — this is the expected first-run path for anyone who hasn't finished setup yet, not a failure.
- The combined "Overall" bar (per spec: "Progress bar per prayer type + one combined overall progress bar") sums `initial_count`/`remaining_count` across all 5 fetched rows rather than being its own backend value — there's no dedicated "overall" endpoint, and summing client-side keeps it trivially consistent with the 5 individual bars.
- `components/prayer/QadaProgressBar.tsx` needs `initial_count` as a fixed baseline to compute percent-complete — this is why Day 15 added that field to the backend's `QadaDebt` model (migration `0003_qadadebt_initial_count`) rather than deriving a percentage from `remaining_count` alone, which can't show "how far along" once Day 16 starts decrementing it.
- **Gotcha**: any View using `accessibilityRole="progressbar"` also needs the `accessible` prop set explicitly, or React Native Testing Library's `getByRole('progressbar')` won't find it in tests even though the prop is present in the rendered output — `ProgressRing.tsx` already does this; `QadaProgressBar.tsx` needed the same fix during Day 15.
- **Day 16 logging**: each prayer row has its own "Log a qada [prayer]" button — the spec's "choose which prayer type" IS tapping that specific button, so no separate picker/modal was added. On press, `handleLogPrayer(prayer)` calls `api.logQadaPrayer()` and updates just that row's state from the response's `debt` object (`setState` merges `{ [prayer]: result.debt }` into the existing `rows` map) — no refetch of the other 4 rows needed, and the "Overall" bar recomputes automatically on the next render since it derives from `state.rows`.
- The log button is **hidden**, not just disabled, once `remaining_count` reaches 0 for that prayer — avoids a dead/disabled button sitting next to a bar that already says "All caught up."
- A failed log attempt (e.g. a stale UI showing debt that's actually already 0, or a network error) shows the backend's `detail` message in an error banner rather than silently doing nothing or crediting fake progress — the row's numbers are only ever updated from a real server response, never optimistically.

## Testing

**141 tests across 16 suites, all passing** as of Day 16:

- `lib/api.test.ts` (14, incl. 3 `updateProfile` + 4 `listQadaDebt`/`calculateQadaDebt` + 2 new `logQadaPrayer` tests), `lib/location.test.ts` (8), `lib/prayerTimes.test.ts` (15), `lib/session.test.ts` (6, includes concurrency tests), `lib/prayerLogSync.test.ts` (7), `lib/calendar.test.ts` (17), `lib/qadaSetup.test.ts` (18)
- `hooks/usePrayerDay.test.ts` (8)
- `components/prayer/ProgressRing.test.tsx` (7), `PrayerRow.test.tsx` (7), `LocationSetupBanner.test.tsx` (5), `MonthCalendar.test.tsx` (6), `QadaProgressBar.test.tsx` (5)
- `app/__tests__/history.test.tsx` (3), `app/__tests__/qada-setup.test.tsx` (5), `app/__tests__/qada-tracker.test.tsx` (11, +4 new for the log button's appearance/disappearance/success/error)

Run: `npx jest` (whole suite) or `npx jest <path>` (single file).

**Verification note (Day 16):** the full 141-test suite, `tsc --noEmit`, `expo lint`, and `expo export --platform web` were all actually run this session (3 consecutive jest runs) — all clean. No new route was added this session, so no typed-routes regeneration was needed this time (unlike Days 13/15).

**Also run before considering any change done:**

```bash
npx tsc --noEmit          # 0 errors expected
npx expo lint              # 0 errors expected
npx expo export --platform web   # confirms real bundling + catches routing bugs
                                   # like the app/history.test.tsx incident —
                                   # inspect the printed route list, don't just
                                   # check the export "succeeded"
```

## Local dev setup

```bash
npm install
# create .env (see gotcha #3 above):
# EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-IP>:8000
npx expo start
```

Key installed packages beyond the default Expo template (all version-pinned to SDK 54 — see gotcha #4): `react-native-svg@15.12.1`, `expo-location@~19.0.7`, `expo-secure-store@~15.0.8`, `expo-asset@~12.0.13` (a hidden peer dep of `expo-font`/vector-icons that wasn't installed by default), `jest-expo@~54.0.18`, `@testing-library/react-native@14.0.1`.

## Known frontend gaps (Day 17+ work)

- Qada tracker now has setup (Day 13), a real backend calculation (Day 14), a display screen with progress bars (Day 15), and logging (Day 16) — but **no estimated-completion-date UI** yet (Day 17's rolling 2-week average).
- No streak UI (`Brand.streak` color defined but nothing renders with it).
- Family mode: no UI for adding/switching child profiles, though the backend data model already supports it.
- Dark mode: the Expo template's `useColorScheme` boilerplate exists, but the prayer screens' hardcoded `Brand.paper`/`Brand.ink` values don't adapt to system dark mode — not yet addressed.
- `app/day/[date].tsx` doesn't show historical prayer times (only status) — Aladhan supports historical dates if this gets prioritized later.
- No real login/signup screens (Day 19) — see root `CLAUDE.md`'s auth warning.
- `app/qada-setup.tsx`'s date fields are plain text inputs (`YYYY-MM-DD`), not a native date picker — no such package is installed yet.
