import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

import { initMapbox } from '@/lib/mapbox';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLocationStore } from '@/stores/useLocationStore';

import '../global.css';

export default function RootLayout(): React.JSX.Element {
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);
  const session = useAuthStore((state) => state.session);
  const setBiometricUnlocked = useAuthStore(
    (state) => state.setBiometricUnlocked,
  );

  const loadLastKnownLocation = useLocationStore(
    (state) => state.loadLastKnownLocation,
  );

  const router = useRouter();
  const segments = useSegments();

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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}
