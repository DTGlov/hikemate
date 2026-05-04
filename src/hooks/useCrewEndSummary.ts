import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCrewStore } from '@/stores/useCrewStore';
import type { CrewMember, HikeCrew } from '@/types/crew';
import type { HikeStats, SavedHike } from '@/types/hike';

export type SummaryMember = {
  user_id: string;
  display_name: string;
  avatar_seed: string | null;
  color: string;
  stats: HikeStats | null;
  isMe: boolean;
};

type UseCrewEndSummaryResult = {
  isLoading: boolean;
  error: string | null;
  crew: HikeCrew | null;
  members: SummaryMember[];
  myHike: SavedHike | null;
};

/**
 * Reads the lastEndedCrew snapshot from the store and merges in the
 * current user's persisted hike row (if any) for the polyline map.
 *
 * RLS limits us to the current user's own hikes, so the map only
 * draws our own track. Other members appear as a stats-only row built
 * from their last crew-stats broadcast captured in the snapshot.
 */
export function useCrewEndSummary(): UseCrewEndSummaryResult {
  const lastEndedCrew = useCrewStore((s) => s.lastEndedCrew);
  const myUserId = useAuthStore((s) => s.user?.id ?? null);

  const [myHike, setMyHike] = useState<SavedHike | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lastEndedCrew || !myUserId) {
      setMyHike(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void (async () => {
      // Match the most recent hike that overlapped this crew session.
      // 5-min trailing buffer absorbs save latency / clock skew between
      // the snapshot moment and the hike row's ended_at.
      const sinceIso = lastEndedCrew.crew.started_at;
      const untilMs = new Date(lastEndedCrew.endedAt).getTime() + 5 * 60 * 1000;
      const untilIso = new Date(untilMs).toISOString();
      const { data, error: queryError } = await supabase
        .from('hikes')
        .select('*')
        .eq('user_id', myUserId)
        .gte('started_at', sinceIso)
        .lte('ended_at', untilIso)
        .order('ended_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
      } else if (data && data.length > 0) {
        setMyHike(data[0] as SavedHike);
      } else {
        setMyHike(null);
      }
      setIsLoading(false);
    })();
    return (): void => {
      cancelled = true;
    };
  }, [lastEndedCrew, myUserId]);

  const members: SummaryMember[] = lastEndedCrew
    ? Object.values(lastEndedCrew.members)
        .map<SummaryMember>((m: CrewMember) => ({
          user_id: m.user_id,
          display_name: m.display_name,
          avatar_seed: m.avatar_seed,
          color: m.color,
          stats: lastEndedCrew.liveStats[m.user_id] ?? null,
          isMe: m.user_id === myUserId,
        }))
        .sort((a, b) => {
          if (a.isMe) return -1;
          if (b.isMe) return 1;
          return a.display_name.localeCompare(b.display_name);
        })
    : [];

  return {
    isLoading,
    error,
    crew: lastEndedCrew?.crew ?? null,
    members,
    myHike,
  };
}
