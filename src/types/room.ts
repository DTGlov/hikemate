export interface HikeRoom {
  id: string;
  code: string;
  name: string | null;
  host_id: string;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface RoomMember {
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
