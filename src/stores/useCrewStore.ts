import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import type {
  CrewMember,
  CrewStatsBroadcast,
  HikeCrew,
  MemberLivePosition,
  MemberPositionBroadcast,
} from '@/types/crew';
import type { HikeStats } from '@/types/hike';

const RECENT_PATH_WINDOW_MS = 30 * 60 * 1000;
const RECENT_PATH_MAX_POINTS = 360; // 30 min × 12 broadcasts/min cap

type CrewState = {
  crew: HikeCrew | null;
  myUserId: string | null;
  members: Record<string, CrewMember>;
  livePositions: Record<string, MemberLivePosition>;
  // Live HikeStats from each tracking member, keyed by user_id. Ephemeral —
  // populated by Phase 6.5 'crew-stats' broadcasts; cleared on stop.
  liveStats: Record<string, HikeStats>;
  isHost: boolean;
  // Live realtime channel for this crew. Held in store (not a ref) so
  // every consumer re-renders when it appears or disappears — refs don't
  // trigger reconciliation and React 18 batching can swallow the
  // surrounding setState calls used to "wake" subscribers.
  channel: RealtimeChannel | null;

  setCrew: (crew: HikeCrew, members: CrewMember[], myUserId: string) => void;
  upsertMember: (member: CrewMember) => void;
  removeMember: (userId: string) => void;
  updateMemberPosition: (broadcast: MemberPositionBroadcast) => void;
  updateMemberStats: (broadcast: CrewStatsBroadcast) => void;
  setOnlineUserIds: (onlineUserIds: string[]) => void;
  setChannel: (channel: RealtimeChannel | null) => void;
  clearChannel: () => void;
  clearCrew: () => void;
};

function pruneRecentPath(
  path: MemberLivePosition['recentPath'],
  now: number,
): MemberLivePosition['recentPath'] {
  const cutoff = now - RECENT_PATH_WINDOW_MS;
  // Drop expired entries from the head; cap total length too.
  let firstIdx = 0;
  while (firstIdx < path.length && path[firstIdx].timestamp < cutoff) {
    firstIdx++;
  }
  const trimmed = firstIdx > 0 ? path.slice(firstIdx) : path;
  if (trimmed.length > RECENT_PATH_MAX_POINTS) {
    return trimmed.slice(trimmed.length - RECENT_PATH_MAX_POINTS);
  }
  return trimmed;
}

function seedLivePosition(member: CrewMember): MemberLivePosition | null {
  if (member.last_known_lat === null || member.last_known_lng === null) {
    return null;
  }
  return {
    user_id: member.user_id,
    lat: member.last_known_lat,
    lng: member.last_known_lng,
    altitude: member.last_known_altitude,
    timestamp: new Date(member.last_seen_at).getTime(),
    recentPath: [],
    isOnline: false,
  };
}

export const useCrewStore = create<CrewState>((set, get) => ({
  crew: null,
  myUserId: null,
  members: {},
  livePositions: {},
  liveStats: {},
  isHost: false,
  channel: null,

  setChannel: (channel): void => set({ channel }),
  clearChannel: (): void => set({ channel: null }),

  setCrew: (crew, members, myUserId): void => {
    const memberMap: Record<string, CrewMember> = {};
    const positions: Record<string, MemberLivePosition> = {};
    for (const m of members) {
      memberMap[m.user_id] = m;
      const seed = seedLivePosition(m);
      if (seed) positions[m.user_id] = seed;
    }
    set({
      crew,
      myUserId,
      members: memberMap,
      livePositions: positions,
      liveStats: {},
      isHost: crew.host_id === myUserId,
    });
  },

  upsertMember: (member): void => {
    const state = get();
    const positions = { ...state.livePositions };
    const existing = positions[member.user_id];
    const seed = seedLivePosition(member);
    if (seed) {
      // If we already have a richer livePosition (with broadcasts), keep
      // its recentPath but update lat/lng to the freshest known.
      positions[member.user_id] = existing
        ? {
            ...existing,
            lat: seed.lat,
            lng: seed.lng,
            altitude: seed.altitude,
          }
        : seed;
    }
    set({
      members: { ...state.members, [member.user_id]: member },
      livePositions: positions,
    });
  },

  removeMember: (userId): void => {
    const state = get();
    if (!state.members[userId]) return;
    const members = { ...state.members };
    const livePositions = { ...state.livePositions };
    const liveStats = { ...state.liveStats };
    delete members[userId];
    delete livePositions[userId];
    delete liveStats[userId];
    set({ members, livePositions, liveStats });
  },

  updateMemberPosition: (broadcast): void => {
    const state = get();
    if (!state.members[broadcast.user_id]) return; // ignore strangers
    const existing = state.livePositions[broadcast.user_id];
    const path = existing?.recentPath ?? [];
    const nextPath = pruneRecentPath(
      [
        ...path,
        {
          lat: broadcast.lat,
          lng: broadcast.lng,
          timestamp: broadcast.timestamp,
        },
      ],
      Date.now(),
    );
    const next: MemberLivePosition = {
      user_id: broadcast.user_id,
      lat: broadcast.lat,
      lng: broadcast.lng,
      altitude: broadcast.altitude,
      timestamp: broadcast.timestamp,
      recentPath: nextPath,
      isOnline: true,
    };
    set({
      livePositions: { ...state.livePositions, [broadcast.user_id]: next },
    });
  },

  updateMemberStats: (broadcast): void => {
    const state = get();
    if (!state.members[broadcast.user_id]) return; // ignore strangers
    const next = { ...state.liveStats };
    if (broadcast.stopped) {
      if (!(broadcast.user_id in next)) return;
      delete next[broadcast.user_id];
    } else {
      next[broadcast.user_id] = {
        distanceMeters: broadcast.distance_meters,
        durationSeconds: broadcast.duration_seconds,
        elevationGainMeters: broadcast.elevation_gain_meters,
        elevationLossMeters: 0,
        currentPaceSecPerKm: broadcast.current_pace_sec_per_km,
      };
    }
    set({ liveStats: next });
  },

  setOnlineUserIds: (onlineUserIds): void => {
    const state = get();
    const onlineSet = new Set(onlineUserIds);
    let changed = false;
    const next: Record<string, MemberLivePosition> = {};
    for (const [userId, position] of Object.entries(state.livePositions)) {
      const isOnline = onlineSet.has(userId);
      if (position.isOnline !== isOnline) changed = true;
      next[userId] =
        isOnline === position.isOnline ? position : { ...position, isOnline };
    }
    if (changed) set({ livePositions: next });
  },

  clearCrew: (): void => {
    set({
      crew: null,
      myUserId: null,
      members: {},
      livePositions: {},
      liveStats: {},
      isHost: false,
      channel: null,
    });
  },
}));
