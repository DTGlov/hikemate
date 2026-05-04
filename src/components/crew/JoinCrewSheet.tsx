import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { joinCrew } from '@/hooks/useCrew';
import { setActiveCrewId } from '@/lib/activeCrewPersistence';
import { emailToDisplayName } from '@/lib/displayName';
import { colorForUser } from '@/lib/memberColor';
import { isValidCrewCode } from '@/lib/crewCode';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProfileStore } from '@/stores/useProfileStore';
import type { HikeCrew } from '@/types/crew';

const CODE_LENGTH = 6;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Optional pre-filled code from a deep link. */
  initialCode?: string;
};

export function JoinCrewSheet({
  visible,
  onClose,
  initialCode,
}: Props): React.JSX.Element {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const userEmail = useAuthStore((s) => s.user?.email ?? null);
  const profileName = useProfileStore((s) => s.profile?.display_name ?? null);
  const profileAvatarSeed = useProfileStore(
    (s) => s.profile?.avatar_seed ?? null,
  );

  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setCode((initialCode ?? '').toUpperCase().slice(0, CODE_LENGTH));
    // Defer so the modal animation completes before keyboard slides up.
    const id = setTimeout(() => inputRef.current?.focus(), 250);
    return (): void => clearTimeout(id);
  }, [visible, initialCode]);

  const onChangeCode = (next: string): void => {
    const clean = next
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, CODE_LENGTH);
    setCode(clean);
    setError(null);
  };

  const handleJoin = async (): Promise<void> => {
    if (!userId) return;
    if (!isValidCrewCode(code)) {
      setError('Enter a 6-character code');
      return;
    }
    setIsJoining(true);
    setError(null);

    // Look up the crew by code, ensuring it's active.
    const { data: crewRow, error: lookupError } = await supabase
      .from('hike_rooms')
      .select('*')
      .eq('code', code)
      .is('ended_at', null)
      .maybeSingle();
    if (lookupError) {
      setIsJoining(false);
      setError(lookupError.message);
      return;
    }
    if (!crewRow) {
      setIsJoining(false);
      setError('No active crew found for that code.');
      return;
    }
    const crew = crewRow as HikeCrew;
    if (new Date(crew.expires_at).getTime() <= Date.now()) {
      setIsJoining(false);
      setError('This crew has expired.');
      return;
    }

    const displayName =
      profileName?.trim() && profileName.trim() !== userEmail
        ? profileName.trim()
        : userEmail
          ? emailToDisplayName(userEmail)
          : 'Hiker';
    const { error: joinError } = await joinCrew({
      crewId: crew.id,
      userId,
      displayName,
      color: colorForUser(userId),
      avatarSeed: profileAvatarSeed ?? userId,
    });
    setIsJoining(false);
    if (joinError) {
      setError(joinError);
      return;
    }
    await setActiveCrewId(crew.id);
    setCode('');
    onClose();
  };

  const handleClose = (): void => {
    setCode('');
    setError(null);
    onClose();
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

          <View className="gap-5">
            <View className="gap-1">
              <Text className="text-2xl font-bold text-gray-900">
                Join a crew
              </Text>
              <Text className="text-sm text-gray-600">
                Enter the 6-letter code your group shared with you.
              </Text>
            </View>

            <Pressable onPress={() => inputRef.current?.focus()}>
              <View className="flex-row justify-between gap-2">
                {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                  const ch = code[i] ?? '';
                  const isCursor = i === code.length;
                  return (
                    <View
                      key={i}
                      className={`h-14 flex-1 items-center justify-center rounded-xl border-2 ${
                        isCursor
                          ? 'border-teal-700 bg-teal-50'
                          : ch
                            ? 'border-gray-300 bg-white'
                            : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <Text className="text-2xl font-bold text-gray-900">
                        {ch}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Pressable>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={onChangeCode}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={CODE_LENGTH}
              keyboardType="default"
              accessibilityLabel="Crew code"
              style={{
                position: 'absolute',
                opacity: 0,
                width: 1,
                height: 1,
              }}
            />

            {error ? (
              <Text className="text-sm text-red-600">{error}</Text>
            ) : null}

            <View className="gap-3">
              <Button
                label="Join Crew"
                onPress={() => void handleJoin()}
                isLoading={isJoining}
                disabled={code.length !== CODE_LENGTH}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
