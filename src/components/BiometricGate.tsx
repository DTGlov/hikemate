import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useBiometricLock } from '@/hooks/useBiometricLock';
import { useAuthStore } from '@/stores/useAuthStore';

type Props = {
  children: React.ReactNode;
};

export function BiometricGate({ children }: Props): React.JSX.Element {
  const session = useAuthStore((state) => state.session);
  const isBiometricUnlocked = useAuthStore(
    (state) => state.isBiometricUnlocked,
  );

  if (!session || isBiometricUnlocked) {
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
          <Text className="text-2xl font-bold text-gray-900">
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
