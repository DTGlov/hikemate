import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';

import { endRoomAsHost } from '@/hooks/useRoom';

export function RoomHostControls(): React.JSX.Element {
  const [isWorking, setIsWorking] = useState(false);

  const onEndRoom = (): void => {
    Alert.alert(
      'End room for everyone?',
      'All members will be removed from the room. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Room',
          style: 'destructive',
          onPress: async () => {
            setIsWorking(true);
            const { error } = await endRoomAsHost();
            setIsWorking(false);
            if (error) Alert.alert('Could not end room', error);
          },
        },
      ],
    );
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="End room for everyone"
      onPress={onEndRoom}
      disabled={isWorking}
      className="h-11 flex-row items-center gap-2 rounded-full border border-red-200 bg-white px-5 active:bg-red-50"
    >
      <Ionicons name="stop-circle-outline" size={18} color="#dc2626" />
      <Text className="text-sm font-semibold text-red-600">End Room</Text>
    </Pressable>
  );
}
