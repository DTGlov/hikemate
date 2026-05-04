import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useBiometricLock } from '@/hooks/useBiometricLock';
import { useBiometricLockPref } from '@/hooks/useBiometricLockPref';
import { useAuthStore } from '@/stores/useAuthStore';

const GRACE_PERIOD_MS = 10_000;

type Props = {
  children: React.ReactNode;
};

export function BiometricGate({ children }: Props): React.JSX.Element {
  const session = useAuthStore((state) => state.session);
  const isBiometricUnlocked = useAuthStore(
    (state) => state.isBiometricUnlocked,
  );
  const lastUnlockedAt = useAuthStore((state) => state.lastUnlockedAt);
  const setBiometricUnlocked = useAuthStore(
    (state) => state.setBiometricUnlocked,
  );
  const { isEnabled: lockPrefEnabled, isLoading: lockPrefLoading } =
    useBiometricLockPref();

  // Grace period: if the user unlocked recently and we're being asked to
  // re-evaluate (e.g. AppState fired 'background' on a swipe-then-return),
  // skip the prompt instead of forcing a fresh biometric. The JS context
  // survived the brief absence, so we can trust the recent unlock.
  // On a true cold start, lastUnlockedAt resets to null (in-memory state)
  // so this branch can't fire — biometrics are still required.
  useEffect(() => {
    if (
      session &&
      !isBiometricUnlocked &&
      lastUnlockedAt !== null &&
      Date.now() - lastUnlockedAt < GRACE_PERIOD_MS
    ) {
      setBiometricUnlocked(true);
    }
  }, [session, isBiometricUnlocked, lastUnlockedAt, setBiometricUnlocked]);

  // While the pref is loading, render a blank surface to avoid flashing
  // either the lock screen or the unlocked app before we know which is
  // correct. SecureStore reads typically finish in tens of milliseconds.
  if (lockPrefLoading) {
    return <View className="flex-1 bg-white" />;
  }

  if (!session || isBiometricUnlocked || !lockPrefEnabled) {
    return <>{children}</>;
  }
  return <LockScreen />;
}

function LockScreen(): React.JSX.Element {
  const { kind, isAuthenticating, errorMessage, authenticate } =
    useBiometricLock();

  const label =
    kind === 'face'
      ? 'Unlock with Face ID'
      : kind === 'fingerprint'
        ? 'Unlock with Fingerprint'
        : 'Unlock';
  const iconName: keyof typeof Ionicons.glyphMap =
    kind === 'face' ? 'scan-outline' : 'finger-print-outline';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center gap-6 px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-teal-50">
          <Ionicons name={iconName} size={44} color="#0f766e" />
        </View>
        <View className="items-center gap-1">
          <Text className="font-bold text-2xl text-gray-900">
            HikeMate is locked
          </Text>
          <Text className="text-center text-base text-gray-600">
            Authenticate to view your hikes.
          </Text>
        </View>
        {errorMessage ? (
          <Text className="text-sm text-red-600">{errorMessage}</Text>
        ) : null}
        <View className="w-full max-w-xs">
          <Button
            label={label}
            onPress={authenticate}
            isLoading={isAuthenticating}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
