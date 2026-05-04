import { PointAnnotation } from '@rnmapbox/maps';
import { Text, View } from 'react-native';

import { initialsFromDisplayName } from '@/lib/displayName';
import type { MemberLivePosition, CrewMember } from '@/types/crew';

type Props = {
  member: CrewMember;
  position: MemberLivePosition;
  onSelected?: () => void;
};

export function CrewMemberDot({
  member,
  position,
  onSelected,
}: Props): React.JSX.Element {
  const initials = initialsFromDisplayName(member.display_name);

  return (
    <PointAnnotation
      id={`member-${member.user_id}`}
      coordinate={[position.lng, position.lat]}
      onSelected={onSelected}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: member.color,
          borderWidth: 3,
          borderColor: '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: position.isOnline ? 1 : 0.5,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Text
          style={{
            color: '#ffffff',
            fontWeight: '700',
            fontSize: 12,
          }}
        >
          {initials}
        </Text>
      </View>
    </PointAnnotation>
  );
}
