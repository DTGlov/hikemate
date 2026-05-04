import { Text, View } from 'react-native';

import { initialsFromDisplayName } from '@/lib/displayName';

type Props = {
  color: string;
  displayName: string;
  size: number;
  /** When false, the circle is dimmed — used by the bottom sheet's offline rows. */
  isOnline?: boolean;
};

/**
 * Map-marker style avatar: solid circle in the member's color with white
 * initials centered on top. Also used as the loading + error fallback
 * inside <Avatar />.
 */
export function ColoredInitialsCircle({
  color,
  displayName,
  size,
  isOnline = true,
}: Props): React.JSX.Element {
  const fontSize = Math.max(10, Math.round(size * 0.32));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isOnline ? 1 : 0.55,
      }}
    >
      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize }}>
        {initialsFromDisplayName(displayName)}
      </Text>
    </View>
  );
}
