import polyline from '@mapbox/polyline';
import Mapbox from '@rnmapbox/maps';

import type { HikePoint } from '@/types/hike';

let initialized = false;

export function initMapbox(): void {
  if (initialized) return;
  initialized = true;

  const token = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;
  if (!token) {
    console.warn(
      'EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN is missing. Map tiles will not load. ' +
        'Add a public Mapbox token (pk.…) to .env.',
    );
    return;
  }
  void Mapbox.setAccessToken(token);
}

const STATIC_PATH_COLOR = '4+0f766e'; // line width + teal
const MAX_THUMBNAIL_POINTS = 100; // Mapbox URL has a length cap; downsample.

function downsample(points: HikePoint[], target: number): HikePoint[] {
  if (points.length <= target) return points;
  const step = (points.length - 1) / (target - 1);
  const out: HikePoint[] = [];
  for (let i = 0; i < target; i++) {
    out.push(points[Math.round(i * step)]);
  }
  return out;
}

/**
 * Build a Mapbox Static Images API URL that server-renders a route polyline
 * over an Outdoors basemap. Used for hike list thumbnails — fast on scroll
 * because it's a plain Image, no native MapView per row.
 */
export function getHikeThumbnailUrl(
  path: HikePoint[],
  width: number = 320,
  height: number = 180,
): string | null {
  const token = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;
  if (!token || path.length < 2) return null;
  const sampled = downsample(path, MAX_THUMBNAIL_POINTS);
  const encoded = polyline.encode(
    sampled.map((p) => [p.latitude, p.longitude]),
  );
  const overlay = `path-${STATIC_PATH_COLOR}(${encodeURIComponent(encoded)})`;
  return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${overlay}/auto/${width}x${height}@2x?access_token=${token}&padding=20`;
}
