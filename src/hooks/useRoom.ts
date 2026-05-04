import { useEffect, useState } from 'react';

import { clearActiveRoomId } from '@/lib/activeRoomPersistence';
import { subscribeToRoom, teardownChannel } from '@/lib/realtimeChannels';
import { generateRoomCode } from '@/lib/roomCode';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRoomStore } from '@/stores/useRoomStore';
import type { HikeRoom, RoomMember } from '@/types/room';

type UseRoomResult = {
  isLoading: boolean;
  error: string | null;
  endedReason: 'host-ended' | null;
};

/**
 * Mounts the channel for the currently-joined room. Reads the active
 * room id from useRoomStore — meant to be called by the root layout (or
 * a screen that owns the room session). Cleans up on unmount.
 *
 * The store is hydrated separately (via joinRoom / restoreActiveRoom).
 * This hook just wires the realtime channel onto whatever room is in the
 * store and tears it down on store.clearRoom().
 */
export function useRoom(): UseRoomResult {
  const room = useRoomStore((s) => s.room);
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const upsertMember = useRoomStore((s) => s.upsertMember);
  const removeMember = useRoomStore((s) => s.removeMember);
  const updateMemberPosition = useRoomStore((s) => s.updateMemberPosition);
  const setOnlineUserIds = useRoomStore((s) => s.setOnlineUserIds);
  const setChannel = useRoomStore((s) => s.setChannel);
  const clearChannel = useRoomStore((s) => s.clearChannel);
  const clearRoom = useRoomStore((s) => s.clearRoom);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endedReason, setEndedReason] =
    useState<UseRoomResult['endedReason']>(null);

  useEffect(() => {
    setEndedReason(null);
    if (!room || !myUserId) {
      // Tear down any leftover channel from a prior room session.
      const existing = useRoomStore.getState().channel;
      if (existing) {
        clearChannel();
        void teardownChannel(existing);
      }
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const channel = subscribeToRoom(room.id, myUserId, {
      onMemberJoined: (member: RoomMember) => {
        if (cancelled) return;
        upsertMember(member);
      },
      onMemberLeft: (userId) => {
        if (cancelled) return;
        removeMember(userId);
      },
      onMemberUpdated: (member: RoomMember) => {
        if (cancelled) return;
        upsertMember(member);
      },
      onRoomEnded: () => {
        if (cancelled) return;
        setEndedReason('host-ended');
        void clearActiveRoomId();
        clearRoom();
      },
      onPositionBroadcast: (broadcast) => {
        if (cancelled) return;
        updateMemberPosition(broadcast);
      },
      onPresenceSync: (onlineUserIds) => {
        if (cancelled) return;
        setOnlineUserIds(onlineUserIds);
      },
    });
    // Publish the channel into the store so every subscriber re-renders
    // and picks it up — relying on co-located setState calls to "wake"
    // consumers is unsafe under React 18 batching when those states
    // collapse to no-ops (see commit message for the bug we just fixed).
    setChannel(channel);
    setIsLoading(false);

    return (): void => {
      cancelled = true;
      const captured = useRoomStore.getState().channel;
      clearChannel();
      if (captured) void teardownChannel(captured);
    };
  }, [
    room?.id,
    myUserId,
    upsertMember,
    removeMember,
    updateMemberPosition,
    setOnlineUserIds,
    setChannel,
    clearChannel,
    clearRoom,
    room,
  ]);

  // Re-poll the room row periodically to detect 24-hour expiry. The host
  // ending the room is delivered via UPDATE realtime; expiry just rolls
  // over the timestamp without anyone updating ended_at, so we check.
  useEffect(() => {
    if (!room) return;
    const id = setInterval(() => {
      const expiresAt = new Date(room.expires_at).getTime();
      if (Date.now() >= expiresAt) {
        setEndedReason('host-ended');
        void clearActiveRoomId();
        clearRoom();
      }
    }, 30_000);
    return (): void => clearInterval(id);
  }, [room, clearRoom]);

  return {
    isLoading,
    error,
    endedReason,
  };
}

/**
 * Create a new room with a generated 6-letter code. Retries on the rare
 * unique-violation collision (alphabet is 31 chars, 6-char codes give
 * ~887M combinations — collisions are negligible in practice).
 */
export async function createRoom(params: {
  hostUserId: string;
  hostDisplayName: string;
  hostColor: string;
  name: string | null;
}): Promise<{ room: HikeRoom | null; error: string | null }> {
  const { hostUserId, hostDisplayName, hostColor, name } = params;

  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from('hike_rooms')
      .insert({ code, name, host_id: hostUserId })
      .select('*')
      .single();
    if (!error && data) {
      const room = data as HikeRoom;
      // Auto-join the host as the first member.
      const join = await joinRoom({
        roomId: room.id,
        userId: hostUserId,
        displayName: hostDisplayName,
        color: hostColor,
      });
      if (join.error) return { room: null, error: join.error };
      return { room, error: null };
    }
    if (error?.code !== '23505') {
      // Not a unique-violation — surface the error.
      return { room: null, error: error?.message ?? 'Failed to create room' };
    }
  }
  return { room: null, error: 'Could not generate a unique room code' };
}

/**
 * Convenience: insert the member row, fetch room + members, hydrate the
 * store. Used by both the join flow and silent-rejoin on cold start.
 */
export async function joinRoom(params: {
  roomId: string;
  userId: string;
  displayName: string;
  color: string;
}): Promise<{ error: string | null }> {
  const { roomId, userId, displayName, color } = params;
  const { error: insertError } = await supabase.from('room_members').upsert({
    room_id: roomId,
    user_id: userId,
    display_name: displayName,
    color,
  });
  if (insertError) return { error: insertError.message };

  const { data: roomRow, error: roomError } = await supabase
    .from('hike_rooms')
    .select('*')
    .eq('id', roomId)
    .single();
  if (roomError) return { error: roomError.message };
  if ((roomRow as HikeRoom).ended_at) {
    return { error: 'This room has ended.' };
  }

  const { data: members, error: membersError } = await supabase
    .from('room_members')
    .select('*')
    .eq('room_id', roomId);
  if (membersError) return { error: membersError.message };

  useRoomStore
    .getState()
    .setRoom(roomRow as HikeRoom, (members ?? []) as RoomMember[], userId);
  return { error: null };
}

export async function leaveRoom(): Promise<void> {
  const state = useRoomStore.getState();
  const room = state.room;
  const myUserId = state.myUserId;
  if (!room || !myUserId) return;

  // Optimistic local clear, then DB delete. RLS allows the user to delete
  // their own member row; if it fails (already deleted, etc.) we don't care.
  state.clearRoom();
  await clearActiveRoomId();
  await supabase
    .from('room_members')
    .delete()
    .eq('room_id', room.id)
    .eq('user_id', myUserId);
}

export async function endRoomAsHost(): Promise<{ error: string | null }> {
  const room = useRoomStore.getState().room;
  if (!room) return { error: 'No active room' };
  const { error: rpcError } = await supabase.rpc('end_hike_room', {
    p_room_id: room.id,
  });
  if (rpcError) return { error: rpcError.message };
  // The realtime UPDATE will fire and clear local state; force-clearing
  // here as well so the host sees instant feedback.
  await clearActiveRoomId();
  useRoomStore.getState().clearRoom();
  return { error: null };
}
