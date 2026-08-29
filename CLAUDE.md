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
  (tabs)/index.tsx            — solo home screen (today's prayers)
  history.tsx                 — calendar/history view
  day/[date].tsx              — day-detail screen (view/edit any past date)
  _layout.tsx                 — root Stack, registers all screens
  __tests__/                  — test files that would otherwise live under app/ but can't
components/prayer/            — ProgressRing, PrayerRow, MonthCalendar, LocationSetupBanner
hooks/usePrayerDay.ts          — shared load/tap/persist logic (today AND day-detail screen both use this)
lib/
  api.ts                       — typed API client, Basic Auth support
  session.ts                   — device-session bootstrap (see root CLAUDE.md's auth warning)
  prayerLogSync.ts             — POST-vs-PATCH decision logic for marking a prayer
  calendar.ts                  — pure month-grid + completion logic, canonical date formatters
  prayerTimes.ts               — Aladhan API client
  location.ts                  — GPS permission + manual city/country fallback
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

## Testing

**92 tests across 12 suites, all passing** as of Day 12:

- `lib/api.test.ts` (5), `lib/location.test.ts` (8), `lib/prayerTimes.test.ts` (15), `lib/session.test.ts` (6, includes concurrency tests), `lib/prayerLogSync.test.ts` (7), `lib/calendar.test.ts` (17)
- `hooks/usePrayerDay.test.ts` (8)
- `components/prayer/ProgressRing.test.tsx` (7), `PrayerRow.test.tsx` (7), `LocationSetupBanner.test.tsx` (5), `MonthCalendar.test.tsx` (6)
- `app/__tests__/history.test.tsx` (3)

Run: `npx jest` (whole suite) or `npx jest <path>` (single file).

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

## Known frontend gaps (Day 13+ work)

- No qada tracker UI at all yet (Day 13's task — birth date/bulugh age/gender/practice-start-date form, `PATCH`ing to `/api/profiles/{id}/`, which already supports these fields).
- No streak UI (`Brand.streak` color defined but nothing renders with it).
- Family mode: no UI for adding/switching child profiles, though the backend data model already supports it.
- Dark mode: the Expo template's `useColorScheme` boilerplate exists, but the prayer screens' hardcoded `Brand.paper`/`Brand.ink` values don't adapt to system dark mode — not yet addressed.
- `app/day/[date].tsx` doesn't show historical prayer times (only status) — Aladhan supports historical dates if this gets prioritized later.
- No real login/signup screens (Day 19) — see root `CLAUDE.md`'s auth warning.
