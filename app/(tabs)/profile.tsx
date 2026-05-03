import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useAuthStore } from '@/stores/useAuthStore';

export default function ProfileScreen(): React.JSX.Element {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async (): Promise<void> => {
    setIsSigningOut(true);
    setError(null);
    const { error: signOutError } = await signOut();
    if (signOutError) setError(signOutError.message);
    setIsSigningOut(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-between px-6 py-8">
        <View className="gap-6">
          <Text className="text-3xl font-bold text-gray-900">Profile</Text>
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-500">
              Signed in as
            </Text>
            <Text className="text-lg text-gray-900">
              {user?.email ?? 'Unknown'}
            </Text>
          </View>
        </View>

        <View className="gap-3">
          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
          <Button
            label="Log out"
            variant="secondary"
            onPress={handleSignOut}
            isLoading={isSigningOut}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
