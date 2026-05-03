# HikeMate

A hiking companion app for tracking solo and group hikes.

## Stack

- **Expo SDK 54** with a custom dev build (we use `expo run:ios` / `expo run:android`)
- **TypeScript** (strict mode)
- **Expo Router** — file-based routing
- **NativeWind v4** — Tailwind for React Native
- **Zustand** — state management
- **Supabase** — auth (email/password), session persistence via SecureStore
- **expo-local-authentication** — Face ID / Touch ID app lock
- **@rnmapbox/maps** — Mapbox map view
- **expo-location** — foreground location tracking
- **ESLint + Prettier**

## Running the app

```bash
npm install
npm run ios           # first run installs CocoaPods (5–10 min)
npm run android       # first run installs Gradle deps (5–10 min)
npm run start         # `expo start --dev-client` for hot reload after the first build
```

Other scripts:

```bash
npm run lint
npm run format
npm run typecheck
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `EXPO_PUBLIC_SUPABASE_URL` — from Supabase dashboard → Project Settings → API
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same place
- `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN` — Mapbox public token (`pk.…`) from
  https://account.mapbox.com/access-tokens/

`.env` is gitignored. `.env.example` is committed.

## Mapbox Setup

`@rnmapbox/maps` needs **two** tokens. They live in different places.

### 1. Public token — runtime, in `.env`

Used by the JS SDK to load tiles. Starts with `pk.`. Goes in `.env`:

```
EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN=pk.ey...
```

### 2. Secret token — build-time only, NOT in the project

Used by CocoaPods (iOS) and Gradle (Android) to download the native Mapbox
SDK from a private Maven/Cocoapods repo. Starts with `sk.`. **Never commit
it. Never put it in `.env` or `app.json`.**

Create one at https://account.mapbox.com/access-tokens/ with the
`Downloads:Read` scope.

**iOS** — add to `~/.netrc` (create the file if it doesn't exist):

```
machine api.mapbox.com
  login mapbox
  password sk.YOUR_SECRET_TOKEN_HERE
```

Then `chmod 600 ~/.netrc` so other users on the machine can't read it.

**Android** — add to `~/.gradle/gradle.properties` (create if needed):

```
MAPBOX_DOWNLOADS_TOKEN=sk.YOUR_SECRET_TOKEN_HERE
```

> Note: Recent versions of `@rnmapbox/maps` have relaxed the Android
> requirement, but setting `MAPBOX_DOWNLOADS_TOKEN` is still the safe
> default and is required for any older SDK fallback.

After updating either file, re-run `npm run ios` / `npm run android`.

## Folder structure

```
/app                  ← Expo Router routes
  /(auth)             ← unauthenticated screens (login, signup)
  /(tabs)             ← main tab navigator (Home / Hikes / Profile)
/src
  /components         ← reusable components
    /map              ← map-related components
  /stores             ← Zustand stores (auth, location)
  /lib                ← clients (supabase, mapbox)
  /types              ← shared TypeScript types
  /hooks              ← custom hooks
/assets               ← icons, splash images
/ios, /android        ← gitignored, regenerated via `npx expo prebuild --clean`
```

## Native rebuilds

Whenever you change `app.json` plugins, native deps, or permissions, you
must rebuild:

```bash
npx expo prebuild --clean    # regenerates ios/ and android/
npm run ios                  # or android
```
