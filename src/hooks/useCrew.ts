import { useEffect, useState } from 'react';

import { clearActiveCrewId } from '@/lib/activeCrewPersistence';
import { subscribeToCrew, teardownChannel } from '@/lib/realtimeChannels';
import { generateCrewCode } from '@/lib/crewCode';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCrewStore } from '@/stores/useCrewStore';
import type { HikeCrew, CrewMember } from '@/types/crew';

type UseCrewResult = {
  isLoading: boolean;
  error: string | null;
  endedReason: 'host-ended' | null;
};

/**
 * Mounts the channel for the currently-joined crew. Reads the active
 * crew id from useCrewStore — meant to be called by the root layout (or
 * a screen that owns the crew session). Cleans up on unmount.
 *
 * The store is hydrated separately (via joinCrew / restoreActiveCrew).
 * This hook just wires the realtime channel onto whatever crew is in the
 * store and tears it down on store.clearCrew().
 */
export function useCrew(): UseCrewResult {
  const crew = useCrewStore((s) => s.crew);
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const upsertMember = useCrewStore((s) => s.upsertMember);
  const removeMember = useCrewStore((s) => s.removeMember);
  const updateMemberPosition = useCrewStore((s) => s.updateMemberPosition);
  const updateMemberStats = useCrewStore((s) => s.updateMemberStats);
  const setOnlineUserIds = useCrewStore((s) => s.setOnlineUserIds);
  const setChannel = useCrewStore((s) => s.setChannel);
  const clearChannel = useCrewStore((s) => s.clearChannel);
  const clearCrew = useCrewStore((s) => s.clearCrew);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endedReason, setEndedReason] =
    useState<UseCrewResult['endedReason']>(null);

  useEffect(() => {
    setEndedReason(null);
    if (!crew || !myUserId) {
      // Tear down any leftover channel from a prior crew session.
      const existing = useCrewStore.getState().channel;
      if (existing) {
        clearChannel();
        void teardownChannel(existing);
      }
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const channel = subscribeToCrew(crew.id, myUserId, {
      onMemberJoined: (member: CrewMember) => {
        if (cancelled) return;
        upsertMember(member);
      },
      onMemberLeft: (userId) => {
        if (cancelled) return;
        removeMember(userId);
      },
      onMemberUpdated: (member: CrewMember) => {
        if (cancelled) return;
        upsertMember(member);
      },
      onCrewEnded: () => {
        if (cancelled) return;
        setEndedReason('host-ended');
        void clearActiveCrewId();
        clearCrew();
      },
      onPositionBroadcast: (broadcast) => {
        if (cancelled) return;
        updateMemberPosition(broadcast);
      },
      onCrewStatsBroadcast: (broadcast) => {
        if (cancelled) return;
        updateMemberStats(broadcast);
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
      const captured = useCrewStore.getState().channel;
      clearChannel();
      if (captured) void teardownChannel(captured);
    };
  }, [
    crew?.id,
    myUserId,
    upsertMember,
    removeMember,
    updateMemberPosition,
    updateMemberStats,
    setOnlineUserIds,
    setChannel,
    clearChannel,
    clearCrew,
    crew,
  ]);

  // Re-poll the crew row periodically to detect 24-hour expiry. The host
  // ending the crew is delivered via UPDATE realtime; expiry just rolls
  // over the timestamp without anyone updating ended_at, so we check.
  useEffect(() => {
    if (!crew) return;
    const id = setInterval(() => {
      const expiresAt = new Date(crew.expires_at).getTime();
      if (Date.now() >= expiresAt) {
        setEndedReason('host-ended');
        void clearActiveCrewId();
        clearCrew();
      }
    }, 30_000);
    return (): void => clearInterval(id);
  }, [crew, clearCrew]);

  return {
    isLoading,
    error,
    endedReason,
  };
}

/**
 * Create a new crew with a generated 6-letter code. Retries on the rare
 * unique-violation collision (alphabet is 31 chars, 6-char codes give
 * ~887M combinations — collisions are negligible in practice).
 */
export async function createCrew(params: {
  hostUserId: string;
  hostDisplayName: string;
  hostColor: string;
  name: string | null;
}): Promise<{ crew: HikeCrew | null; error: string | null }> {
  const { hostUserId, hostDisplayName, hostColor, name } = params;

  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateCrewCode();
    const { data, error } = await supabase
      .from('hike_rooms')
      .insert({ code, name, host_id: hostUserId })
      .select('*')
      .single();
    if (!error && data) {
      const crew = data as HikeCrew;
      // Auto-join the host as the first member.
      const join = await joinCrew({
        crewId: crew.id,
        userId: hostUserId,
        displayName: hostDisplayName,
        color: hostColor,
      });
      if (join.error) return { crew: null, error: join.error };
      return { crew, error: null };
    }
    if (error?.code !== '23505') {
      // Not a unique-violation — surface the error.
      return { crew: null, error: error?.message ?? 'Failed to create crew' };
    }
  }
  return { crew: null, error: 'Could not generate a unique crew code' };
}

/**
 * Convenience: insert the member row, fetch crew + members, hydrate the
 * store. Used by both the join flow and silent-rejoin on cold start.
 */
export async function joinCrew(params: {
  crewId: string;
  userId: string;
  displayName: string;
  color: string;
}): Promise<{ error: string | null }> {
  const { crewId, userId, displayName, color } = params;
  const { error: insertError } = await supabase.from('room_members').upsert({
    room_id: crewId,
    user_id: userId,
    display_name: displayName,
    color,
  });
  if (insertError) return { error: insertError.message };

  const { data: crewRow, error: crewError } = await supabase
    .from('hike_rooms')
    .select('*')
    .eq('id', crewId)
    .single();
  if (crewError) return { error: crewError.message };
  if ((crewRow as HikeCrew).ended_at) {
    return { error: 'This crew has ended.' };
  }

  const { data: members, error: membersError } = await supabase
    .from('room_members')
    .select('*')
    .eq('room_id', crewId);
  if (membersError) return { error: membersError.message };

  useCrewStore
    .getState()
    .setCrew(crewRow as HikeCrew, (members ?? []) as CrewMember[], userId);
  return { error: null };
}

export async function leaveCrew(): Promise<void> {
  const state = useCrewStore.getState();
  const crew = state.crew;
  const myUserId = state.myUserId;
  if (!crew || !myUserId) return;

  // Optimistic local clear, then DB delete. RLS allows the user to delete
  // their own member row; if it fails (already deleted, etc.) we don't care.
  state.clearCrew();
  await clearActiveCrewId();
  await supabase
    .from('room_members')
    .delete()
    .eq('room_id', crew.id)
    .eq('user_id', myUserId);
}

export async function endCrewAsHost(): Promise<{ error: string | null }> {
  const crew = useCrewStore.getState().crew;
  if (!crew) return { error: 'No active crew' };
  const { error: rpcError } = await supabase.rpc('end_hike_room', {
    p_room_id: crew.id,
  });
  if (rpcError) return { error: rpcError.message };
  // The realtime UPDATE will fire and clear local state; force-clearing
  // here as well so the host sees instant feedback.
  await clearActiveCrewId();
  useCrewStore.getState().clearCrew();
  return { error: null };
}
