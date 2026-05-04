import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { setActiveCrewId } from '@/lib/activeCrewPersistence';
import { emailToDisplayName } from '@/lib/displayName';
import { colorForUser } from '@/lib/memberColor';
import { createCrew } from '@/hooks/useCrew';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProfileStore } from '@/stores/useProfileStore';
import type { HikeCrew } from '@/types/crew';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function CreateCrewSheet({
  visible,
  onClose,
}: Props): React.JSX.Element {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const userEmail = useAuthStore((s) => s.user?.email ?? null);
  const profileName = useProfileStore((s) => s.profile?.display_name ?? null);

  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCrew, setCreatedCrew] = useState<HikeCrew | null>(null);

  const displayName =
    profileName?.trim() && profileName.trim() !== userEmail
      ? profileName.trim()
      : userEmail
        ? emailToDisplayName(userEmail)
        : 'Hiker';

  const handleCreate = async (): Promise<void> => {
    if (!userId) return;
    setIsCreating(true);
    setError(null);
    const { crew, error: createError } = await createCrew({
      hostUserId: userId,
      hostDisplayName: displayName,
      hostColor: colorForUser(userId),
      name: name.trim() ? name.trim() : `${displayName}'s Hike`,
    });
    setIsCreating(false);
    if (createError || !crew) {
      setError(createError ?? 'Failed to create crew');
      return;
    }
    setCreatedCrew(crew);
    await setActiveCrewId(crew.id);
  };

  const handleClose = (): void => {
    setName('');
    setCreatedCrew(null);
    setError(null);
    onClose();
  };

  const handleCopyCode = async (): Promise<void> => {
    if (!createdCrew) return;
    await Clipboard.setStringAsync(createdCrew.code);
  };

  const handleShare = async (): Promise<void> => {
    if (!createdCrew) return;
    try {
      await Share.share({
        message: `Join my hike on HikeMate — code ${createdCrew.code}\nhikemate://crew/${createdCrew.code}`,
      });
    } catch (err) {
      console.warn('Share failed', err);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="rounded-t-3xl bg-white p-6 pb-10">
          <View className="mb-4 items-center">
            <View className="h-1 w-12 rounded-full bg-gray-300" />
          </View>

          {createdCrew ? (
            <View className="gap-5">
              <View className="items-center gap-2">
                <Text className="text-2xl font-bold text-gray-900">
                  Crew ready
                </Text>
                <Text className="text-center text-sm text-gray-600">
                  Share this code with people you want to hike with.
                </Text>
              </View>
              <View className="items-center rounded-2xl bg-teal-50 px-6 py-6">
                <Text className="text-5xl font-bold tracking-[6px] text-teal-700">
                  {createdCrew.code}
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={handleCopyCode}
                  className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 active:bg-gray-50"
                >
                  <Ionicons name="copy-outline" size={18} color="#0f766e" />
                  <Text className="text-base font-semibold text-gray-900">
                    Copy
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleShare}
                  className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-teal-700 active:bg-teal-800"
                >
                  <Ionicons name="share-outline" size={18} color="#ffffff" />
                  <Text className="text-base font-semibold text-white">
                    Share
                  </Text>
                </Pressable>
              </View>
              <Button label="Start Hiking Together" onPress={handleClose} />
            </View>
          ) : (
            <View className="gap-5">
              <View className="gap-1">
                <Text className="text-2xl font-bold text-gray-900">
                  Create a crew
                </Text>
                <Text className="text-sm text-gray-600">
                  Get a 6-letter code to share with the group.
                </Text>
              </View>

              <View className="gap-1.5">
                <Text className="text-sm font-medium text-gray-700">
                  Crew name (optional)
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={`${displayName}'s Hike`}
                  placeholderTextColor="#9ca3af"
                  className="h-12 rounded-xl border border-gray-300 bg-white px-3.5 text-base text-gray-900"
                />
              </View>

              {error ? (
                <Text className="text-sm text-red-600">{error}</Text>
              ) : null}

              <View className="gap-3">
                <Button
                  label="Create Crew"
                  onPress={() => void handleCreate()}
                  isLoading={isCreating}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={handleClose}
                  className="h-12 items-center justify-center"
                >
                  <Text className="text-base text-gray-600">Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
