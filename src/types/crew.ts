export interface HikeCrew {
  id: string;
  code: string;
  name: string | null;
  host_id: string;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  created_at: string;
  // Phase 7 — meeting point columns. Null when the host hasn't dropped a
  // pin (or has cleared it).
  meeting_point_lat: number | null;
  meeting_point_lng: number | null;
  meeting_point_label: string | null;
  meeting_point_set_at: string | null;
}

/**
 * Phase 7 — derived view of the meeting-point columns on hike_rooms.
 * Null when the host hasn't dropped a pin.
 */
export interface MeetingPoint {
  lat: number;
  lng: number;
  label: string;
  setAt: string;
}

export function extractMeetingPoint(crew: HikeCrew): MeetingPoint | null {
  if (
    crew.meeting_point_lat === null ||
    crew.meeting_point_lng === null ||
    crew.meeting_point_set_at === null
  ) {
    return null;
  }
  return {
    lat: crew.meeting_point_lat,
    lng: crew.meeting_point_lng,
    label: crew.meeting_point_label ?? 'Meeting Point',
    setAt: crew.meeting_point_set_at,
  };
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
