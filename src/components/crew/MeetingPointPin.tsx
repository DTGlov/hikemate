import { Ionicons } from '@expo/vector-icons';
import { PointAnnotation } from '@rnmapbox/maps';
import { Text, View } from 'react-native';

import type { MeetingPoint } from '@/types/crew';

type Props = {
  point: MeetingPoint;
  onSelected?: () => void;
};

/**
 * Pin marker for the crew's meeting point. Single instance per crew —
 * rendered for every member (host or not). Tap surface is the pin
 * itself; the parent decides what to show on tap (e.g., arrival count).
 */
export function MeetingPointPin({
  point,
  onSelected,
}: Props): React.JSX.Element {
  return (
    <PointAnnotation
      id="meeting-point"
      coordinate={[point.lng, point.lat]}
      anchor={{ x: 0.5, y: 1 }}
      onSelected={onSelected}
    >
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 2,
        }}
      >
        <Ionicons name="location-sharp" size={36} color="#0f766e" />
        <Text
          style={{
            marginTop: -4,
            fontSize: 11,
            fontWeight: '600',
            color: '#0f766e',
            backgroundColor: '#ffffff',
            borderRadius: 6,
            paddingHorizontal: 4,
            paddingVertical: 1,
            overflow: 'hidden',
          }}
        >
          {point.label}
        </Text>
      </View>
    </PointAnnotation>
  );
}
