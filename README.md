# HikeMate

A hiking companion app for tracking solo and group hikes.

## Stack

- **Expo SDK 54** with a custom dev client (not Expo Go in later phases)
- **TypeScript** (strict mode)
- **Expo Router** — file-based routing
- **NativeWind v4** — Tailwind for React Native
- **Zustand** — state management
- **ESLint + Prettier**

## Running the app

Install dependencies and start Metro:

```bash
npm install
npx expo start --dev-client
```

> **Note:** `--dev-client` flag is for the custom development build we'll
> generate in Phase 2. Until then, you can run `npx expo start` and open the
> project in Expo Go — there are no native modules yet, so it works.

Useful scripts:

```bash
npm run lint        # ESLint
npm run format      # Prettier --write
npm run typecheck   # tsc --noEmit
```

## Folder structure

```
/app                  ← Expo Router routes
  /(auth)             ← unauthenticated screens (login, signup)
  /(tabs)             ← main tab navigator (Home / Hikes / Profile)
/src
  /components         ← reusable components
  /stores             ← Zustand stores
  /lib                ← utilities, clients (e.g. supabase, later)
  /types              ← shared TypeScript types
  /hooks              ← custom hooks
/assets               ← icons, splash images
```

## Custom dev build

This project will require a custom development build starting in Phase 2 when
native modules are introduced. We will generate `ios/` and `android/` folders
via `expo prebuild` then. Until that point everything runs in Expo Go.
