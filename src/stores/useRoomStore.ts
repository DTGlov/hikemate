import { create } from 'zustand';

import type {
  HikeRoom,
  MemberLivePosition,
  MemberPositionBroadcast,
  RoomMember,
} from '@/types/room';

const RECENT_PATH_WINDOW_MS = 30 * 60 * 1000;
const RECENT_PATH_MAX_POINTS = 360; // 30 min × 12 broadcasts/min cap

type RoomState = {
  room: HikeRoom | null;
  myUserId: string | null;
  members: Record<string, RoomMember>;
  livePositions: Record<string, MemberLivePosition>;
  isHost: boolean;

  setRoom: (room: HikeRoom, members: RoomMember[], myUserId: string) => void;
  upsertMember: (member: RoomMember) => void;
  removeMember: (userId: string) => void;
  updateMemberPosition: (broadcast: MemberPositionBroadcast) => void;
  setOnlineUserIds: (onlineUserIds: string[]) => void;
  clearRoom: () => void;
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

function seedLivePosition(member: RoomMember): MemberLivePosition | null {
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

export const useRoomStore = create<RoomState>((set, get) => ({
  room: null,
  myUserId: null,
  members: {},
  livePositions: {},
  isHost: false,

  setRoom: (room, members, myUserId): void => {
    const memberMap: Record<string, RoomMember> = {};
    const positions: Record<string, MemberLivePosition> = {};
    for (const m of members) {
      memberMap[m.user_id] = m;
      const seed = seedLivePosition(m);
      if (seed) positions[m.user_id] = seed;
    }
    set({
      room,
      myUserId,
      members: memberMap,
      livePositions: positions,
      isHost: room.host_id === myUserId,
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
    delete members[userId];
    delete livePositions[userId];
    set({ members, livePositions });
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

  clearRoom: (): void => {
    set({
      room: null,
      myUserId: null,
      members: {},
      livePositions: {},
      isHost: false,
    });
  },
}));
