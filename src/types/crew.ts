export interface HikeCrew {
  id: string;
  code: string;
  name: string | null;
  host_id: string;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface CrewMember {
  room_id: string;
  user_id: string;
  display_name: string;
  color: string;
  joined_at: string;
  last_known_lat: number | null;
  last_known_lng: number | null;
  last_known_altitude: number | null;
  last_seen_at: string;
}

export interface MemberPositionBroadcast {
  user_id: string;
  lat: number;
  lng: number;
  altitude: number | null;
  timestamp: number;
}

export type RecentPathPoint = {
  lat: number;
  lng: number;
  timestamp: number;
};

export interface MemberLivePosition {
  user_id: string;
  lat: number;
  lng: number;
  altitude: number | null;
  timestamp: number;
  recentPath: RecentPathPoint[];
  isOnline: boolean;
}

/**
 * Phase 6.5 — Hybrid Crew Stats. While a crew member is actively hiking
 * they broadcast a snapshot of their HikeStats every 10s on the same crew
 * channel as positions, but on a separate `crew-stats` event. When the
 * member stops tracking, a one-shot { stopped: true } broadcast clears
 * their entry from peers' livestats maps.
 */
export type CrewStatsBroadcast =
  | {
      user_id: string;
      stopped?: false;
      distance_meters: number;
      duration_seconds: number;
      current_pace_sec_per_km: number | null;
      elevation_gain_meters: number;
      timestamp: number;
    }
  | {
      user_id: string;
      stopped: true;
      timestamp: number;
    };
