import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

// Side-effect import: registers the TaskManager task at module load so the
// OS can wake JS for background location events even on cold launches.
import '@/lib/backgroundLocationTask';

import { BackgroundTrackingBanner } from '@/components/hike/BackgroundTrackingBanner';
import { useHikeLifecycle } from '@/hooks/useHikeLifecycle';
import { clearInProgressHike } from '@/lib/hikePersistence';
import { initMapbox } from '@/lib/mapbox';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useProfileStore } from '@/stores/useProfileStore';

import '../global.css';

export default function RootLayout(): React.JSX.Element {
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);
  const session = useAuthStore((state) => state.session);
  const setBiometricUnlocked = useAuthStore(
    (state) => state.setBiometricUnlocked,
  );

  const userId = useAuthStore((state) => state.user?.id ?? null);
  const loadProfile = useProfileStore((state) => state.loadProfile);
  const resetProfile = useProfileStore((state) => state.reset);

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
  useEffect(() => {
    if (userId) {
      void loadProfile(userId);
    } else {
      resetProfile();
      useHikeTrackingStore.getState().resetHike();
      void clearInProgressHike();
    }
  }, [userId, loadProfile, resetProfile]);

  useEffect(() => {
    initMapbox();
    void loadLastKnownLocation();
  }, [loadLastKnownLocation]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    // Only lock when the app actually backgrounds. iOS fires 'inactive' for
    // many transient interruptions where the user hasn't left the app —
    // app switcher peek, Notification Center / Control Center swipe-down,
    // incoming call banners, system permission dialogs. Treating those as
    // a lock event causes the biometric prompt to fire mid-transition and
    // immediately fail. 'background' is the real "user left the app" signal.
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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
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
      <BackgroundTrackingBanner />
    </View>
  );
}
