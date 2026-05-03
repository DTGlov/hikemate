import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ActiveRoomBanner } from '@/components/room/ActiveRoomBanner';
import { useRoom, joinRoom, leaveRoom } from '@/hooks/useRoom';
import { useRoomBroadcast } from '@/hooks/useRoomBroadcast';
import {
  clearActiveRoomId,
  clearPendingRoomCode,
  getActiveRoomId,
  getPendingRoomCode,
  setPendingRoomCode,
} from '@/lib/activeRoomPersistence';
import { emailToDisplayName } from '@/lib/displayName';
import { colorForUser } from '@/lib/memberColor';
import { initMapbox } from '@/lib/mapbox';
import { isValidRoomCode } from '@/lib/roomCode';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useProfileStore } from '@/stores/useProfileStore';
import type { HikeRoom } from '@/types/room';

import '../global.css';

function extractRoomCodeFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    // Match /room/CODE OR room://CODE depending on how the OS hands it over.
    const path = parsed.path ?? '';
    const match = path.match(/^room\/([A-Z0-9]{6})$/i);
    if (match) return match[1].toUpperCase();
    if (parsed.hostname === 'room' && parsed.path) {
      const code = parsed.path.replace(/^\/+/, '').toUpperCase();
      if (isValidRoomCode(code)) return code;
    }
    return null;
  } catch {
    return null;
  }
}

async function joinRoomByCode(params: {
  code: string;
  userId: string;
  displayName: string;
}): Promise<{ error: string | null }> {
  const { code, userId, displayName } = params;
  const { data: roomRow, error: lookupError } = await supabase
    .from('hike_rooms')
    .select('*')
    .eq('code', code)
    .is('ended_at', null)
    .maybeSingle();
  if (lookupError) return { error: lookupError.message };
  if (!roomRow) return { error: 'No active room found for that code.' };
  const room = roomRow as HikeRoom;
  if (new Date(room.expires_at).getTime() <= Date.now()) {
    return { error: 'This room has expired.' };
  }
  return joinRoom({
    roomId: room.id,
    userId,
    displayName,
    color: colorForUser(userId),
  });
}

export default function RootLayout(): React.JSX.Element {
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

  // Wire the realtime channel for the currently-joined room (no-op if none).
  const { channel: roomChannel } = useRoom();
  useRoomBroadcast(roomChannel);

  const restoredRef = useRef(false);

  // Load the user's profile whenever the active user changes; reset + leave
  // any active room on logout so data doesn't leak across users on a
  // shared device.
  useEffect(() => {
    if (userId) {
      void loadProfile(userId);
    } else {
      resetProfile();
      void leaveRoom();
      void clearActiveRoomId();
      restoredRef.current = false;
    }
  }, [userId, loadProfile, resetProfile]);

  // Silently rejoin a previously-joined room on cold start (or when the
  // user just signed in and there's a pending room id).
  useEffect(() => {
    if (!userId) return;
    if (restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      const activeRoomId = await getActiveRoomId();
      if (!activeRoomId) return;
      const { data, error } = await supabase
        .from('hike_rooms')
        .select('*')
        .eq('id', activeRoomId)
        .is('ended_at', null)
        .maybeSingle();
      if (error || !data) {
        await clearActiveRoomId();
        return;
      }
      const room = data as HikeRoom;
      if (new Date(room.expires_at).getTime() <= Date.now()) {
        await clearActiveRoomId();
        return;
      }
      const displayName =
        profileName?.trim() && profileName.trim() !== userEmail
          ? profileName.trim()
          : userEmail
            ? emailToDisplayName(userEmail)
            : 'Hiker';
      const { error: joinError } = await joinRoom({
        roomId: room.id,
        userId,
        displayName,
        color: colorForUser(userId),
      });
      if (joinError) await clearActiveRoomId();
    })();
  }, [userId, profileName, userEmail]);

  // Honor pending-deep-link codes once the user is authed.
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const pending = await getPendingRoomCode();
      if (!pending) return;
      await clearPendingRoomCode();
      const displayName =
        profileName?.trim() && profileName.trim() !== userEmail
          ? profileName.trim()
          : userEmail
            ? emailToDisplayName(userEmail)
            : 'Hiker';
      const { error } = await joinRoomByCode({
        code: pending,
        userId,
        displayName,
      });
      if (error) Alert.alert('Could not join room', error);
    })();
  }, [userId, profileName, userEmail]);

  // Handle hikemate://room/CODE deep links — both initial-launch URL and
  // links received while the app is alive.
  useEffect(() => {
    let cancelled = false;
    const handle = async (url: string | null): Promise<void> => {
      if (cancelled || !url) return;
      const code = extractRoomCodeFromUrl(url);
      if (!code) return;
      const currentUserId = useAuthStore.getState().user?.id ?? null;
      if (!currentUserId) {
        await setPendingRoomCode(code);
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
      const { error } = await joinRoomByCode({
        code,
        userId: currentUserId,
        displayName,
      });
      if (error) Alert.alert('Could not join room', error);
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

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#0f766e" />
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
              name="settings"
              options={{ headerShown: true, title: 'Settings' }}
            />
          </Stack>
          <ActiveRoomBanner />
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
