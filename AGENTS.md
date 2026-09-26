This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## VigíaAI — project conventions

- **Start here:** `docs/ESTADO.md` says where the project stands, what's pending, the recommended next steps and how the user works (Spanish, phase approval, commit after they validate on the phone). Then `docs/ARCHITECTURE.md` for the design.
- UI text is **Spanish**; code identifiers are English. Architecture: `docs/ARCHITECTURE.md`.
- `src/domain`, `src/engine`, `src/services` are pure TypeScript — no React/Expo imports there.
- All telemetry goes through `TelemetrySource`; the source is chosen only in `src/services/runtime/index.ts`.
- Species-specific values (thresholds, photoperiod, consumption) live in `src/domain/profiles`, never hardcoded in rules or UI.
- Every automated actuator change must produce a `Decision` with a human-readable reason.
- `store/farmStore.ts` is a vanilla (React-free) store used by the runtime; UI reads it via `useFarmStore` (`store/useFarmStore.ts`).
- Zustand selectors must not return new objects/arrays each call — use `useShallow` over stable references and derive with `useMemo` (see `src/store/selectors.ts`).
- On web, `Link asChild` cannot receive an array `style`; use `router.push` on a `Pressable` instead.
- Screens read history only through `useSensorHistory` (`src/hooks/use-history.ts`); never call the repository from components.
- Charts: one series per chart in `chartLine`; status colors only for threshold bands, always explained by a legend; keep a table-view equivalent. SVG text needs `fontFamily` on web (defaults to serif).
- 3D twin: import `Canvas` only from `src/features/twin/Canvas3D` (web/native split). Scene = procedural geometry; no drei/GLTF/textures (native stability). Everything visible must derive from `TwinState` (`twinState.ts`, pure + tested). Decorative meshes use `raycast={noRaycast}`; per-frame mutable state lives in refs synced via `useEffect` (React Compiler rules). Native runtime can only be verified on a device.
- Web working does NOT prove native works: Metro resolves `require()` with different package-export conditions on native. Keep the `three` → ESM redirect in `metro.config.js` (three CJS calls `process.emitWarning`, absent in Hermes). When adding native-heavy deps, check the iOS bundle (`npx expo export --platform ios --no-bytecode`) for Node-only APIs (`process.emitWarning`, `fs`, …).
- React Compiler memoizes plain function calls made during render: never call `getFarmRuntime()` in a component/hook body (it would keep pointing to an old runtime after a mode switch). Call it inside event handlers; for history use the stable `getFarmHistory()`.
- Real world (phase 6): sun/light come from `domain/solar.ts` + `domain/lighting.ts` (never fixed hours); outside weather only via `WeatherService` (Open-Meteo free tier is NON-commercial; keep the attribution visible). Tests run with TZ=America/Bogota (jest.global-setup.js).
- Animal behavior lives in `domain/behavior` (pure, tested); the 3D layer only maps actions to poses.
- Production (phase 7): the model lives in `domain/production` (pure, tested); `ProductionService` is fed by `FarmRuntime` with each telemetry batch. A day's laying depends on the PREVIOUS day's conditions (egg formation ~25 h). The configured population = hens alive today (the 30-day backfill adds deaths going backwards).
- Farm configuration: `services/config` (validated with `validateConfig`, stored with AsyncStorage). It is loaded by `startFarm()` and changed only through `applyFarmConfig()` (validates, saves, restarts the runtime). UI reads `config` from the store. A restart resets the store (`now` becomes null for a moment), so screens that stay open across it must not unmount their forms.
- Production (phase 9b): daily records (`production_records`, one per barn and day) are the REAL data; the model is the reference. Label every production number as "Registrado" or "Estimado" — never show an estimate as if it were counted. Comparison, farm calibration and drop alerts live in `domain/production/records.ts` (pure, tested). Recorded deaths reduce `zones.population` through a DB trigger — never subtract them in the app for real farms (only the demo farm, in `refreshFarmAfterRecord`). Offline records go to the outbox and are re-sent (`features/production/records.ts`).
- Barns: the app shows ONE barn at a time (`authStore.farm.activeZoneId`, remembered per farm); simulation, config and records are per barn. Change it only through `switchZone` / `createZone` / `removeZone` in `features/account/session.ts`.
- Data consent (Ley 1581): clients and installers accept `DATA_POLICY_VERSION` once (`data_consents`); the admin is the data controller. If the policy text in `services/account/dataPolicy.ts` changes materially, bump the version so everyone re-accepts.
- Forms and the keyboard: put inputs only inside `Screen` (or `KeyboardAwareScroll`) and use `TextField` — together they reserve the space the keyboard covers and scroll the focused field above it (Android edge-to-edge does not resize the window; iOS never does). Never a raw `ScrollView` with `TextInput`s. `react-native-keyboard-controller` is NOT in Expo Go (only with a development build).
- Show user-facing numbers with `utils/format.ts` (`formatCount` → "1.200", `formatPercent`, `formatWeekday`).
- Accounts (phase 9a) use Supabase. Schema changes go ONLY in new files in `supabase/migrations/` (never edit an applied one), then `npm run db:push` and `npm run db:types`. Security lives in the database (RLS). The app only holds the publishable key; the secret key exists only in Edge Functions and scripts (fetched at runtime), never in the app or the repo. `.env` is gitignored — the repo is PUBLIC.
- Login = cédula (internal auth email `<cédula>@vigia.local`; keep `LOGIN_EMAIL_DOMAIN` in sync in `services/account/identity.ts`, the `manage-users` function and `scripts/seed-admin.mjs`). Accounts are created only by `manage-users`; public sign-up is disabled.
- Session flow lives in `features/account/session.ts`; screens call it in handlers. Navigation follows the auth state through `Stack.Protected` in `app/_layout.tsx` — don't `router.replace` after login/logout. A route must be allowed in only ONE auth state: if it stays allowed after the state changes, the router doesn't move the user (bug fixed by splitting `password-setup` from `change-password`). The simulation's config source is chosen with `startFarm(configStore)`; `applyFarmConfig` saves to the active store (phone for the demo, Supabase for a real farm).
- Don't type real credentials into browser checks (they'd go to Supabase). Backend flows are covered by `npm run test:live` (temporary users, cleaned up); `npm test` never touches the network.
- If `tsc` complains about routes after adding files while `expo start` runs, restart the dev server: its typed-routes watcher can add non-route files to `.expo/types/router.d.ts`.
- Before finishing: `npm test`, `npx tsc --noEmit`, `npx expo lint`.
