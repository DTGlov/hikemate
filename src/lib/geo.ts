import type { BoundingBox, HikePoint } from '@/types/hike';

export type LatLng = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6_371_008.8;
const DEFAULT_ELEVATION_NOISE_FLOOR_M = 3;
const DEFAULT_PACE_WINDOW_SECONDS = 60;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in meters between two points (Haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const φ1 = toRadians(a.latitude);
  const φ2 = toRadians(b.latitude);
  const Δφ = toRadians(b.latitude - a.latitude);
  const Δλ = toRadians(b.longitude - a.longitude);
  const sinΔφ2 = Math.sin(Δφ / 2);
  const sinΔλ2 = Math.sin(Δλ / 2);
  const h = sinΔφ2 * sinΔφ2 + Math.cos(φ1) * Math.cos(φ2) * sinΔλ2 * sinΔλ2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sum of pairwise haversine distances along a path. */
export function pathDistanceMeters(points: HikePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Smoothed elevation gain/loss in meters. Only registers altitude changes
 * larger than `minDeltaMeters` to filter GPS noise. Points with null
 * altitude are skipped (don't reset the running reference).
 */
export function elevationDelta(
  points: HikePoint[],
  minDeltaMeters: number = DEFAULT_ELEVATION_NOISE_FLOOR_M,
): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  let reference: number | null = null;
  for (const p of points) {
    if (p.altitude === null) continue;
    if (reference === null) {
      reference = p.altitude;
      continue;
    }
    const delta = p.altitude - reference;
    if (Math.abs(delta) < minDeltaMeters) continue;
    if (delta > 0) gain += delta;
    else loss += -delta;
    reference = p.altitude;
  }
  return { gain, loss };
}

/** [minLng, minLat, maxLng, maxLat]. Empty path → 0,0,0,0. */
export function boundingBox(points: HikePoint[]): BoundingBox {
  if (points.length === 0) return [0, 0, 0, 0];
  let minLng = points[0].longitude;
  let minLat = points[0].latitude;
  let maxLng = points[0].longitude;
  let maxLat = points[0].latitude;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.longitude < minLng) minLng = p.longitude;
    else if (p.longitude > maxLng) maxLng = p.longitude;
    if (p.latitude < minLat) minLat = p.latitude;
    else if (p.latitude > maxLat) maxLat = p.latitude;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Pace in seconds per kilometer over the trailing `windowSeconds` of the
 * path. Returns null when the window has too little data to be meaningful.
 */
export function currentPaceSecPerKm(
  points: HikePoint[],
  windowSeconds: number = DEFAULT_PACE_WINDOW_SECONDS,
): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const cutoff = last.timestamp - windowSeconds * 1000;
  let firstIdx = points.length - 1;
  while (firstIdx > 0 && points[firstIdx - 1].timestamp >= cutoff) {
    firstIdx--;
  }
  if (firstIdx === points.length - 1) return null;
  const slice = points.slice(firstIdx);
  const distance = pathDistanceMeters(slice);
  if (distance < 1) return null;
  const elapsedSeconds = (last.timestamp - slice[0].timestamp) / 1000;
  if (elapsedSeconds <= 0) return null;
  return elapsedSeconds / (distance / 1000);
}
