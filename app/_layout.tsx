import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

import { useAuthStore } from '@/stores/useAuthStore';

import '../global.css';

export default function RootLayout(): React.JSX.Element {
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);
  const session = useAuthStore((state) => state.session);
  const setBiometricUnlocked = useAuthStore(
    (state) => state.setBiometricUnlocked,
  );

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
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
