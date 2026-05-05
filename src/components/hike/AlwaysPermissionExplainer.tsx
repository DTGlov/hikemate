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
  onAllow: () => void;
  onLater: () => void;
};

export function AlwaysPermissionExplainer({
  visible,
  isWorking,
  onAllow,
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
              <Ionicons name="lock-closed-outline" size={44} color="#0f766e" />
            </View>
            <Text className="text-center font-bold text-2xl text-gray-900">
              Keep tracking when your phone is locked
            </Text>
            <Text className="text-center text-base leading-6 text-gray-600">
              HikeMate uses your location in the background only while
              you&apos;re on an active hike. We turn it off the moment you stop.
              Your hike data stays on your device until you save it.
            </Text>
          </View>

          <View className="mt-6 gap-3">
            <Button
              label="Allow Always"
              onPress={onAllow}
              isLoading={isWorking}
            />
            <Pressable
              accessibilityRole="button"
              onPress={onLater}
              disabled={isWorking}
              className="h-12 items-center justify-center"
            >
              <Text className="text-base text-gray-600">Maybe Later</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
