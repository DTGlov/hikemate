import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';

type Props = {
  visible: boolean;
  isWorking: boolean;
  onContinue: () => void;
  onLater: () => void;
};

/**
 * Phase 8 — pre-prompt modal shown before iOS's system notification
 * prompt. Mirrors the Phase 4.5 always-location explainer's shape so the
 * two flows feel consistent.
 */
export function NotificationPermissionExplainer({
  visible,
  isWorking,
  onContinue,
  onLater,
}: Props): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onLater}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="rounded-t-3xl bg-white p-6 pb-10">
          <View className="mb-4 items-center">
            <View className="h-1 w-12 rounded-full bg-gray-300" />
          </View>

          <View className="items-center gap-4 pb-2">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-teal-50">
              <Ionicons
                name="notifications-outline"
                size={44}
                color="#0f766e"
              />
            </View>
            <Text className="text-center font-bold text-2xl text-gray-900">
              Stay coordinated with your crew
            </Text>
            <Text className="text-center text-base leading-6 text-gray-600">
              HikeMate sends gentle reminders before crew hikes start and
              nudges you if you forget to resume a paused hike. Tap continue
              to enable notifications.
            </Text>
          </View>

          <View className="mt-6 gap-3">
            <Button
              label="Continue"
              onPress={onContinue}
              isLoading={isWorking}
            />
            <Pressable
              accessibilityRole="button"
              onPress={onLater}
              disabled={isWorking}
              className="h-12 items-center justify-center"
            >
              <Text className="text-base text-gray-600">Not now</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
