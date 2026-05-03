import { LineLayer, ShapeSource } from '@rnmapbox/maps';
import { useMemo } from 'react';

import type { HikePoint } from '@/types/hike';

type Props = {
  points: HikePoint[];
};

export function HikePathLayer({ points }: Props): React.JSX.Element | null {
  // Memoise on points reference. The tracking store creates a new array
  // on every addPoint, so identity flips exactly when a real update lands.
  const shape = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (points.length < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: points.map((p) => [p.longitude, p.latitude]),
      },
    };
  }, [points]);

  if (!shape) return null;

  return (
    <ShapeSource id="hike-path-source" shape={shape}>
      <LineLayer
        id="hike-path-line"
        style={{
          lineColor: '#0f766e',
          lineWidth: 4,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </ShapeSource>
  );
}
