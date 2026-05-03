export interface HikePoint {
  longitude: number;
  latitude: number;
  altitude: number | null;
  timestamp: number;
}

export type HikeStatus = 'idle' | 'tracking' | 'paused' | 'saving';

export interface HikeStats {
  distanceMeters: number;
  durationSeconds: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  currentPaceSecPerKm: number | null;
}

export type BoundingBox = [number, number, number, number];

export interface SavedHike {
  id: string;
  user_id: string;
  name: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  distance_meters: number;
  elevation_gain_meters: number;
  elevation_loss_meters: number;
  path: HikePoint[];
  bounding_box: BoundingBox;
  created_at: string;
}
