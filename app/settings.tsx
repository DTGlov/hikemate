import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar/Avatar';
import { Button } from '@/components/Button';
import { OfflineMapsSection } from '@/components/settings/OfflineMapsSection';
import { UnitToggle } from '@/components/settings/UnitToggle';
import { colorForUser } from '@/lib/memberColor';
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

  const validateDisplayName = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return 'Too short — at least 2 characters';
    if (trimmed.length > 30) return 'Too long — keep it under 30 characters';
    if (trimmed.includes('@')) return 'Display name cannot contain @';
    return null;
  };

  const onSaveName = async (): Promise<void> => {
    if (!profile) return;
    const trimmed = name.trim();
    if (trimmed === (profile.display_name ?? '').trim()) return;
    const localError = validateDisplayName(name);
    if (localError) {
      setNameError(localError);
      return;
    }
    setIsSavingName(true);
    setNameError(null);
    const { error } = await updateDisplayName(trimmed);
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
        <View className="flex-row items-center gap-3">
          <Avatar
            seed={profile?.avatar_seed ?? null}
            displayName={profile?.display_name ?? userEmail ?? 'Hiker'}
            fallbackColor={profile ? colorForUser(profile.id) : '#0f766e'}
            size={56}
          />
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-medium text-gray-700">Email</Text>
            <Text className="text-base text-gray-900">{userEmail ?? '—'}</Text>
          </View>
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
            onChangeText={(next) => {
              setName(next);
              if (nameError) setNameError(null);
            }}
            onBlur={() => void onSaveName()}
            placeholder="Add a name"
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
            maxLength={30}
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

      <Section title="Offline Maps">
        <OfflineMapsSection />
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
