import { LineLayer, ShapeSource } from '@rnmapbox/maps';
import { useMemo } from 'react';

import type { MemberLivePosition } from '@/types/room';

type Props = {
  position: MemberLivePosition;
  color: string;
};

export function RoomMemberPathLayer({
  position,
  color,
}: Props): React.JSX.Element | null {
  const shape = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (position.recentPath.length < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: position.recentPath.map((p) => [p.lng, p.lat]),
      },
    };
  }, [position.recentPath]);

  if (!shape) return null;

  const sourceId = `room-path-source-${position.user_id}`;
  const layerId = `room-path-line-${position.user_id}`;

  return (
    <ShapeSource id={sourceId} shape={shape}>
      <LineLayer
        id={layerId}
        style={{
          lineColor: color,
          lineOpacity: 0.4,
          lineWidth: 3,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </ShapeSource>
  );
}
