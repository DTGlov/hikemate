import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { UnitToggle } from '@/components/settings/UnitToggle';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProfileStore } from '@/stores/useProfileStore';

export default function SettingsScreen(): React.JSX.Element {
  const profile = useProfileStore((s) => s.profile);
  const updateDisplayName = useProfileStore((s) => s.updateDisplayName);
  const userEmail = useAuthStore((s) => s.user?.email ?? null);
  const signOut = useAuthStore((s) => s.signOut);

  const [name, setName] = useState(profile?.display_name ?? '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const onSaveName = async (): Promise<void> => {
    if (!profile) return;
    if (name.trim() === (profile.display_name ?? '').trim()) return;
    setIsSavingName(true);
    setNameError(null);
    const { error } = await updateDisplayName(name);
    setIsSavingName(false);
    if (error) setNameError(error);
  };

  const onSignOut = async (): Promise<void> => {
    setIsSigningOut(true);
    const { error } = await signOut();
    setIsSigningOut(false);
    if (error) setNameError(error.message);
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 24, gap: 28 }}
    >
      <Section title="Profile">
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-gray-700">Email</Text>
          <Text className="text-base text-gray-900">{userEmail ?? '—'}</Text>
        </View>
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-gray-700">
              Display name
            </Text>
            {isSavingName ? (
              <ActivityIndicator size="small" color="#0f766e" />
            ) : null}
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={() => void onSaveName()}
            placeholder="Add a name"
            placeholderTextColor="#9ca3af"
            className="h-12 rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900"
          />
          {nameError ? (
            <Text className="text-sm text-red-600">{nameError}</Text>
          ) : null}
        </View>
      </Section>

      <Section title="Preferences">
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">Units</Text>
          <UnitToggle />
        </View>
      </Section>

      <Section title="Account">
        <Button
          label="Log out"
          variant="secondary"
          onPress={onSignOut}
          isLoading={isSigningOut}
        />
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View className="gap-3">
      <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </Text>
      <View className="gap-4">{children}</View>
    </View>
  );
}
