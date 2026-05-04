import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';

import { endCrewAsHost } from '@/hooks/useCrew';

export function CrewHostControls(): React.JSX.Element {
  const [isWorking, setIsWorking] = useState(false);

  const onEndCrew = (): void => {
    Alert.alert(
      'End crew for everyone?',
      'All members will be removed from the crew. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Crew',
          style: 'destructive',
          onPress: async () => {
            setIsWorking(true);
            const { error } = await endCrewAsHost();
            setIsWorking(false);
            if (error) Alert.alert('Could not end crew', error);
          },
        },
      ],
    );
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="End crew for everyone"
      onPress={onEndCrew}
      disabled={isWorking}
      className="h-11 flex-row items-center gap-2 rounded-full border border-red-200 bg-white px-5 active:bg-red-50"
    >
      <Ionicons name="stop-circle-outline" size={18} color="#dc2626" />
      <Text className="text-sm font-semibold text-red-600">End Crew</Text>
    </Pressable>
  );
}
