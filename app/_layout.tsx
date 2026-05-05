import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_700Bold,
  useFonts,
} from '@expo-google-fonts/geist';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, AppState, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Side-effect imports: register TaskManager tasks at module load so the
// OS can wake JS for background events even on cold launches.
import '@/lib/backgroundLocationTask';
import '@/lib/meetingPointTask';

import { ActiveCrewBanner } from '@/components/crew/ActiveCrewBanner';
import { BackgroundTrackingBanner } from '@/components/hike/BackgroundTrackingBanner';
import { OutboxBanner } from '@/components/offline/OutboxBanner';
import { useCrew, joinCrew, leaveCrew } from '@/hooks/useCrew';
import { useCrewBroadcast } from '@/hooks/useCrewBroadcast';
import { useCrewStatsBroadcast } from '@/hooks/useCrewStatsBroadcast';
import { useHikeLifecycle } from '@/hooks/useHikeLifecycle';
import { useHikeOutboxSync } from '@/hooks/useHikeOutboxSync';
import { useMeetingPointGeofence } from '@/hooks/useMeetingPointGeofence';
import { useOnlineState } from '@/hooks/useOnlineState';
import {
  clearActiveCrewId,
  clearPendingCrewCode,
  getActiveCrewId,
  getPendingCrewCode,
  setPendingCrewCode,
} from '@/lib/activeCrewPersistence';
import { isValidCrewCode } from '@/lib/crewCode';
import { emailToDisplayName } from '@/lib/displayName';
import { clearOutbox } from '@/lib/hikeOutbox';
import { clearInProgressHike } from '@/lib/hikePersistence';
import { initMapbox } from '@/lib/mapbox';
import { colorForUser } from '@/lib/memberColor';
import { supabase } from '@/lib/supabase';
import { fontFamily } from '@/lib/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCrewStore } from '@/stores/useCrewStore';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useProfileStore } from '@/stores/useProfileStore';
import type { HikeCrew } from '@/types/crew';

import '../global.css';

// Apply Geist as the default font for any bare <Text> across the app
// without having to touch every call site. Tailwind's `font-sans` is
// also pointed at Geist (see tailwind.config.js) so NativeWind class
// usage resolves the same way.
const TextWithDefaults = Text as unknown as {
  defaultProps: { style?: { fontFamily: string } };
};
TextWithDefaults.defaultProps = TextWithDefaults.defaultProps ?? {
  style: undefined,
};
TextWithDefaults.defaultProps.style = {
  ...(TextWithDefaults.defaultProps.style ?? {}),
  fontFamily: fontFamily.regular,
};

// Keep the native splash up until JS + fonts are ready. preventAutoHideAsync
// is safe to call multiple times; failures are non-fatal (catch swallows).
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function extractCrewCodeFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    // Match /crew/CODE OR crew://CODE depending on how the OS hands it over.
    const path = parsed.path ?? '';
    const match = path.match(/^crew\/([A-Z0-9]{6})$/i);
    if (match) return match[1].toUpperCase();
    if (parsed.hostname === 'crew' && parsed.path) {
      const code = parsed.path.replace(/^\/+/, '').toUpperCase();
      if (isValidCrewCode(code)) return code;
    }
    return null;
  } catch {
    return null;
  }
}

async function joinCrewByCode(params: {
  code: string;
  userId: string;
  displayName: string;
  avatarSeed: string;
}): Promise<{ error: string | null }> {
  const { code, userId, displayName, avatarSeed } = params;
  const { data: crewRow, error: lookupError } = await supabase
    .from('hike_rooms')
    .select('*')
    .eq('code', code)
    .is('ended_at', null)
    .maybeSingle();
  if (lookupError) return { error: lookupError.message };
  if (!crewRow) return { error: 'No active crew found for that code.' };
  const crew = crewRow as HikeCrew;
  if (new Date(crew.expires_at).getTime() <= Date.now()) {
    return { error: 'This crew has expired.' };
  }
  return joinCrew({
    crewId: crew.id,
    userId,
    displayName,
    color: colorForUser(userId),
    avatarSeed,
  });
}

export default function RootLayout(): React.JSX.Element {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_700Bold,
  });

  // Hide the native splash once both auth and fonts have settled. Doing
  // this in an effect (rather than during render) avoids the warning
  // about hiding the splash before the first frame is committed.
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);
  const session = useAuthStore((state) => state.session);
  const setBiometricUnlocked = useAuthStore(
    (state) => state.setBiometricUnlocked,
  );

  const userId = useAuthStore((state) => state.user?.id ?? null);
  const userEmail = useAuthStore((state) => state.user?.email ?? null);
  const loadProfile = useProfileStore((state) => state.loadProfile);
  const resetProfile = useProfileStore((state) => state.reset);
  const profileName = useProfileStore(
    (state) => state.profile?.display_name ?? null,
  );

  const loadLastKnownLocation = useLocationStore(
    (state) => state.loadLastKnownLocation,
  );

  const router = useRouter();
  const segments = useSegments();

  // Owns the background-tracking lifecycle (subscription, persistence,
  // hydration, polling). Mounted at root so it survives screen navigation.
  useHikeLifecycle();

  // Load the user's profile whenever the active user changes; reset on
  // logout so we don't show stale data to the next user on this device.
  // Also drop any in-progress hike on logout — we don't want one user's
  // captured points carrying over into another user's account on shared
  // devices.
  // Wire the realtime channel for the currently-joined crew (no-op if none).
  // The channel itself is published into useCrewStore by useCrew; broadcast
  // reads it from there so a single store update wakes all subscribers.
  useCrew();
  useCrewBroadcast();
  useCrewStatsBroadcast();
  useMeetingPointGeofence();
  useOnlineState();
  useHikeOutboxSync();

  const restoredRef = useRef(false);

  // Load the user's profile whenever the active user changes; reset + leave
  // any active crew on logout so data doesn't leak across users on a
  // shared device.
  useEffect(() => {
    if (userId) {
      void loadProfile(userId);
    } else {
      resetProfile();
      useHikeTrackingStore.getState().resetHike();
      void clearInProgressHike();
      void clearOutbox();
      void leaveCrew();
      void clearActiveCrewId();
      restoredRef.current = false;
    }
  }, [userId, loadProfile, resetProfile]);

  // Silently rejoin a previously-joined crew on cold start (or when the
  // user just signed in and there's a pending crew id).
  useEffect(() => {
    if (!userId) return;
    if (restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      const activeRoomId = await getActiveCrewId();
      if (!activeRoomId) return;
      const { data, error } = await supabase
        .from('hike_rooms')
        .select('*')
        .eq('id', activeRoomId)
        .is('ended_at', null)
        .maybeSingle();
      if (error || !data) {
        await clearActiveCrewId();
        return;
      }
      const crew = data as HikeCrew;
      if (new Date(crew.expires_at).getTime() <= Date.now()) {
        await clearActiveCrewId();
        return;
      }
      const displayName =
        profileName?.trim() && profileName.trim() !== userEmail
          ? profileName.trim()
          : userEmail
            ? emailToDisplayName(userEmail)
            : 'Hiker';
      const profile = useProfileStore.getState().profile;
      const { error: joinError } = await joinCrew({
        crewId: crew.id,
        userId,
        displayName,
        color: colorForUser(userId),
        avatarSeed: profile?.avatar_seed ?? userId,
      });
      if (joinError) await clearActiveCrewId();
    })();
  }, [userId, profileName, userEmail]);

  // Honor pending-deep-link codes once the user is authed.
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const pending = await getPendingCrewCode();
      if (!pending) return;
      await clearPendingCrewCode();
      const displayName =
        profileName?.trim() && profileName.trim() !== userEmail
          ? profileName.trim()
          : userEmail
            ? emailToDisplayName(userEmail)
            : 'Hiker';
      const profile = useProfileStore.getState().profile;
      const { error } = await joinCrewByCode({
        code: pending,
        userId,
        displayName,
        avatarSeed: profile?.avatar_seed ?? userId,
      });
      if (error) Alert.alert('Could not join crew', error);
    })();
  }, [userId, profileName, userEmail]);

  // Handle hikemate://crew/CODE deep links — both initial-launch URL and
  // links received while the app is alive.
  useEffect(() => {
    let cancelled = false;
    const handle = async (url: string | null): Promise<void> => {
      if (cancelled || !url) return;
      const code = extractCrewCodeFromUrl(url);
      if (!code) return;
      const currentUserId = useAuthStore.getState().user?.id ?? null;
      if (!currentUserId) {
        await setPendingCrewCode(code);
        return;
      }
      const profile = useProfileStore.getState().profile;
      const currentEmail = useAuthStore.getState().user?.email ?? null;
      const profileTrimmed = profile?.display_name?.trim() ?? '';
      const displayName =
        profileTrimmed && profileTrimmed !== currentEmail
          ? profileTrimmed
          : currentEmail
            ? emailToDisplayName(currentEmail)
            : 'Hiker';
      const { error } = await joinCrewByCode({
        code,
        userId: currentUserId,
        displayName,
        avatarSeed: profile?.avatar_seed ?? currentUserId,
      });
      if (error) Alert.alert('Could not join crew', error);
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => void handle(url));
    return (): void => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    initMapbox();
    void loadLastKnownLocation();
  }, [loadLastKnownLocation]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        setBiometricUnlocked(false);
      }
    });
    return (): void => sub.remove();
  }, [setBiometricUnlocked]);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (session && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [isLoading, session, segments, router]);

  // Phase 6.8 — when a snapshot of an ended crew appears, route to the
  // summary screen. The screen clears the snapshot on Done, which is
  // also the unique signal that lets us navigate (avoiding a loop).
  const lastEndedCrew = useCrewStore((state) => state.lastEndedCrew);
  const lastNavigatedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastEndedCrew) {
      lastNavigatedIdRef.current = null;
      return;
    }
    if (lastNavigatedIdRef.current === lastEndedCrew.crew.id) return;
    lastNavigatedIdRef.current = lastEndedCrew.crew.id;
    router.push(`/crew-summary/${lastEndedCrew.crew.id}`);
  }, [lastEndedCrew, router]);

  // Hold the app blank (under the still-visible native splash) until both
  // auth has settled and Geist has loaded, so no system-font flash leaks.
  if (isLoading || !fontsLoaded) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center bg-white">
          {fontsLoaded ? (
            <ActivityIndicator size="large" color="#0f766e" />
          ) : null}
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <View className="flex-1">
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen
              name="hike/[id]"
              options={{ headerShown: true, title: '' }}
            />
            <Stack.Screen
              name="crew-summary/[roomId]"
              options={{ headerShown: true, title: 'Crew summary' }}
            />
          </Stack>
          <BackgroundTrackingBanner />
          <OutboxBanner />
          <ActiveCrewBanner />
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
