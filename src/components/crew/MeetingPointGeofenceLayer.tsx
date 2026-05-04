import { FillLayer, LineLayer, ShapeSource } from '@rnmapbox/maps';
import { useMemo } from 'react';

import type { MeetingPoint } from '@/types/crew';

const RADIUS_METERS = 100;
const POLYGON_VERTICES = 64;
const EARTH_RADIUS_M = 6_371_000;

function geofenceCircleCoords(
  center: { lat: number; lng: number },
  radiusMeters: number,
): number[][] {
  const points: number[][] = [];
  const latRad = (center.lat * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  for (let i = 0; i <= POLYGON_VERTICES; i++) {
    const angle = (i / POLYGON_VERTICES) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const dLat = (dy / EARTH_RADIUS_M) * (180 / Math.PI);
    const dLng = (dx / (EARTH_RADIUS_M * cosLat)) * (180 / Math.PI);
    points.push([center.lng + dLng, center.lat + dLat]);
  }
  return points;
}

type Props = {
  point: MeetingPoint;
};

/**
 * Visual approximation of the 100m geofence radius — a 64-vertex polygon
 * rendered as a faint teal fill with a thin teal stroke. Identity-stable
 * via useMemo so Mapbox doesn't re-tile when the parent re-renders.
 */
export function MeetingPointGeofenceLayer({ point }: Props): React.JSX.Element {
  const shape = useMemo<GeoJSON.Feature<GeoJSON.Polygon>>(() => {
    const ring = geofenceCircleCoords(point, RADIUS_METERS);
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    };
  }, [point]);

  return (
    <ShapeSource id="meeting-point-geofence" shape={shape}>
      <FillLayer
        id="meeting-point-geofence-fill"
        style={{
          fillColor: '#0f766e',
          fillOpacity: 0.15,
        }}
      />
      <LineLayer
        id="meeting-point-geofence-stroke"
        style={{
          lineColor: '#0f766e',
          lineOpacity: 0.8,
          lineWidth: 1,
        }}
      />
    </ShapeSource>
  );
}
